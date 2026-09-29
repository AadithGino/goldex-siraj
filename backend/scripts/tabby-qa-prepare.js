#!/usr/bin/env node
/**
 * Ensures Tabby QA customers, address, and cart exist in the connected DB.
 * Outputs auth tokens JSON for Playwright (stdout).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env'), quiet: true })
import { Customer } from '../src/models/auth.models.js'
import { Address, CartItem } from '../src/models/commerce.models.js'
import { Product, Variant } from '../src/models/catalog.models.js'
import { issueSession } from '../src/services/auth.service.js'

const QA = {
  success: { phone: '+971500000001', email: 'otp.success@tabby.ai', name: 'Tabby QA Success' },
  reject: { phone: '+971500000002', email: 'otp.success@tabby.ai', name: 'Tabby QA Prescore Reject' },
}

async function upsertCustomer({ phone, email, name }) {
  let customer = await Customer.findOne({ phone })
  if (!customer) {
    customer = await Customer.create({ phone, email, fullName: name, authProvider: 'otp' })
  } else {
    customer.email = email
    customer.fullName = name
    await customer.save()
  }
  return customer
}

async function ensureAddress(customer) {
  let address = await Address.findOne({ customerId: customer.id })
  if (!address) {
    address = await Address.create({
      customerId: customer.id,
      recipientName: customer.fullName || 'Tabby QA',
      phone: customer.phone,
      line1: 'Near Union Metro, Al Rigga',
      line2: 'Dubai',
      city: 'Dubai',
      state: 'Dubai',
      country: 'United Arab Emirates',
      isDefault: true,
    })
  }
  return address
}

async function ensureCart(customer) {
  const variant = await Variant.findOne({ isActive: true, stockQty: { $gt: 0 } }).sort({ updatedAt: -1 })
  if (!variant) throw new Error('No active in-stock variant found for QA cart')
  await CartItem.deleteMany({ customerId: customer.id })
  await CartItem.create({ customerId: customer.id, variantId: variant.id, qty: 1 })
  const product = await Product.findById(variant.productId).select('slug name')
  return { variant, product }
}

async function tokensFor(customer) {
  const session = await issueSession(customer, 'customer')
  return {
    customerId: String(customer.id),
    phone: customer.phone,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  }
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  const successCustomer = await upsertCustomer(QA.success)
  const rejectCustomer = await upsertCustomer(QA.reject)
  const successAddress = await ensureAddress(successCustomer)
  await ensureAddress(rejectCustomer)
  const cartMeta = await ensureCart(successCustomer)
  const success = await tokensFor(successCustomer)
  const reject = await tokensFor(rejectCustomer)
  console.log(JSON.stringify({
    success: { ...success, addressId: String(successAddress.id), productSlug: cartMeta.product?.slug },
    reject: { ...reject },
  }, null, 2))
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
