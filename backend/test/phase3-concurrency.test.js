import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Customer, Staff } from '../src/models/auth.models.js'
import { Brand, Category, Product, ProductImage, StoreSetting, TaxSetting, Variant } from '../src/models/catalog.models.js'
import {
  Address, CartItem, Coupon, CouponCustomerUsage, CouponRedemption, Order, WalletAccount,
} from '../src/models/commerce.models.js'
import { GoldRate } from '../src/models/rate.models.js'
import { hashPassword } from '../src/services/auth.service.js'
import { rollbackCouponRedemption } from '../src/services/coupon.service.js'
import * as orderService from '../src/services/order.service.js'
import * as walletService from '../src/services/wallet.service.js'

let mongoServer
let customer
let address
let variant

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-phase3'))
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})))
  await StoreSetting.create({ singleton: 'default', codEnabled: true, bankTransferEnabled: true, shippingFee: 0, freeShippingThreshold: 0, minOrderAmount: 0 })
  await TaxSetting.create({ singleton: 'default', isActive: true, taxPercent: 5, taxMode: 'exclusive', applyOn: 'total' })
  await GoldRate.create({ purity: '22k', ratePerGram: 250, isCurrent: true, effectiveAt: new Date() })
  customer = await Customer.create({ phone: '+971509000001', fullName: 'P3', authProvider: 'otp' })
  await Staff.create({ fullName: 'M', email: 'p3@example.com', passwordHash: await hashPassword('password-12345678'), role: 'manager' })
  address = await Address.create({
    customerId: customer.id,
    recipientName: 'P3',
    phone: '+971509000001',
    line1: 'Line',
    city: 'Dubai',
    state: 'Dubai',
    country: 'United Arab Emirates',
  })
  const brand = await Brand.create({ name: 'G', slug: 'g-p3', isActive: true })
  const category = await Category.create({ name: 'R', slug: 'r-p3', isActive: true })
  const product = await Product.create({
    name: 'Ring',
    slug: 'ring-p3',
    brandId: brand.id,
    categoryId: category.id,
    status: 'active',
    metalType: 'gold',
    purity: '22k',
  })
  variant = await Variant.create({
    productId: product.id,
    sku: 'P3-1',
    label: '16',
    weightGrams: 3,
    effectiveWeight: 3,
    stockQty: 20,
    purity: '22k',
    isActive: true,
  })
  await ProductImage.create({ productId: product.id, imageUrl: 'https://cdn.example.com/p3.jpg', isPrimary: true })
})

describe('phase 3 concurrency contracts', () => {
  it('returns the same order for simultaneous identical idempotency keys', async () => {
    await CartItem.create({ customerId: customer.id, variantId: variant.id, qty: 1 })
    const [a, b] = await Promise.all([
      orderService.placeOrder(customer.id, {
        address_id: address.id,
        payment_method: 'cod',
        wallet_use: 0,
        idempotency_key: 'same-key-p3',
      }),
      orderService.placeOrder(customer.id, {
        address_id: address.id,
        payment_method: 'cod',
        wallet_use: 0,
        idempotency_key: 'same-key-p3',
      }),
    ])
    expect(String(a.id)).toBe(String(b.id))
    expect(await Order.countDocuments({ idempotencyKey: 'same-key-p3' })).toBe(1)
  })

  it('rolls back coupon capacity only once when rollback is called twice', async () => {
    const coupon = await Coupon.create({
      code: 'RB',
      discountType: 'flat',
      discountValue: 5,
      usageLimit: 5,
      perCustomerLimit: 2,
      usedCount: 1,
      isActive: true,
      validFrom: new Date(Date.now() - 1000),
    })
    const order = await Order.create({
      customerId: customer.id,
      orderNumber: 'ORD-RB-1',
      shipTo: address.toObject(),
      items: [],
      idempotencyKey: 'rb-1',
      paymentMethod: 'cod',
      paymentStatus: 'cod_pending',
    })
    await CouponRedemption.create({
      couponId: coupon.id,
      customerId: customer.id,
      orderId: order.id,
      discountAmount: 5,
      status: 'active',
    })
    await CouponCustomerUsage.create({ couponId: coupon.id, customerId: customer.id, activeCount: 1 })

    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        await rollbackCouponRedemption({ orderId: order.id, reason: 'cancel' }, { session })
      })
      await session.withTransaction(async () => {
        const second = await rollbackCouponRedemption({ orderId: order.id, reason: 'cancel-again' }, { session })
        expect(second).toBeNull()
      })
    } finally {
      await session.endSession()
    }

    const refreshed = await Coupon.findById(coupon.id)
    expect(refreshed.usedCount).toBe(0)
    const usage = await CouponCustomerUsage.findOne({ couponId: coupon.id, customerId: customer.id })
    expect(usage.activeCount).toBe(0)
  })

  it('applies concurrent identical wallet debit keys only once', async () => {
    await WalletAccount.create({ customerId: customer.id, balance: 100 })
    const results = await Promise.all([
      walletService.debit({
        customerId: customer.id,
        amount: 40,
        idempotencyKey: 'wallet-once',
        type: 'purchase',
      }),
      walletService.debit({
        customerId: customer.id,
        amount: 40,
        idempotencyKey: 'wallet-once',
        type: 'purchase',
      }),
    ])
    expect(results.every((row) => row.transaction)).toBe(true)
    const account = await WalletAccount.findOne({ customerId: customer.id })
    expect(account.balance).toBe(60)
  })
})
