#!/usr/bin/env node
/**
 * Creates Tabby checkout sessions via Goldex API and prints payment IDs for the QA email.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env'), quiet: true })

async function main() {
  const mongoose = (await import('mongoose')).default
  const { Customer } = await import('../src/models/auth.models.js')
  const { Address, CartItem } = await import('../src/models/commerce.models.js')
  const orderService = await import('../src/services/order.service.js')

  await mongoose.connect(process.env.MONGODB_URI)
  const phone = process.argv[2] || '+971500000001'
  const customer = await Customer.findOne({ phone })
  if (!customer) throw new Error(`No customer for ${phone}`)
  const address = await Address.findOne({ customerId: customer.id })
  if (!address) throw new Error('No address')
  const cart = await CartItem.findOne({ customerId: customer.id })
  if (!cart) throw new Error('Empty cart — run tabby-qa-prepare.js')

  const key = `tabby-qa-${Date.now()}`
  const order = await orderService.placeOrder(customer.id, {
    address_id: address.id,
    payment_method: 'online',
    payment_provider: 'tabby',
    lang: 'en',
    wallet_use: 0,
    idempotency_key: key,
  })

  console.log(JSON.stringify({
    scenario: phone === '+971500000002' ? 'prescore_reject_expected_at_session' : 'success_session',
    phone,
    order_id: String(order.id),
    order_number: order.orderNumber,
    tabby_payment_id: order.tabbyPaymentId,
    tabby_checkout_id: order.tabbyCheckoutId,
    checkout_url: order.checkoutUrl,
    note: 'Complete HPP with OTP 8888; payment status in Tabby dashboard',
  }, null, 2))
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
