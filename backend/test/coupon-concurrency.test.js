import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Customer, Staff } from '../src/models/auth.models.js'
import { Brand, Category, Product, ProductImage, StoreSetting, TaxSetting, Variant } from '../src/models/catalog.models.js'
import { Address, CartItem, Coupon, CouponCustomerUsage, CouponRedemption, Order } from '../src/models/commerce.models.js'
import { GoldRate } from '../src/models/rate.models.js'
import { hashPassword } from '../src/services/auth.service.js'
import * as adminService from '../src/services/admin.service.js'
import * as orderService from '../src/services/order.service.js'
import { AppError } from '../src/utils/AppError.js'

let mongoServer
let customerA
let customerB
let addressA
let addressB
let variant
let staff

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-coupon-concurrency'))
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})))
  await StoreSetting.create({ singleton: 'default', codEnabled: true, bankTransferEnabled: true, shippingFee: 0, freeShippingThreshold: 0 })
  await TaxSetting.create({ singleton: 'default', isActive: true, taxPercent: 5, taxMode: 'exclusive', applyOn: 'total' })
  await GoldRate.create({ purity: '22k', ratePerGram: 250, isCurrent: true, effectiveAt: new Date() })
  staff = await Staff.create({ fullName: 'S', email: 's@example.com', passwordHash: await hashPassword('password-12345678'), role: 'manager' })
  customerA = await Customer.create({ phone: '+971501000001', fullName: 'A', authProvider: 'otp' })
  customerB = await Customer.create({ phone: '+971501000002', fullName: 'B', authProvider: 'otp' })
  addressA = await Address.create({ customerId: customerA.id, recipientName: 'A', phone: '+971501000001', line1: 'L', city: 'Dubai', state: 'Dubai', country: 'UAE' })
  addressB = await Address.create({ customerId: customerB.id, recipientName: 'B', phone: '+971501000002', line1: 'L', city: 'Dubai', state: 'Dubai', country: 'UAE' })
  const brand = await Brand.create({ name: 'G', slug: 'g-cc', isActive: true })
  const category = await Category.create({ name: 'R', slug: 'r-cc', isActive: true })
  const product = await Product.create({ name: 'Ring', slug: 'ring-cc', brandId: brand.id, categoryId: category.id, status: 'active', metalType: 'gold', purity: '22k' })
  variant = await Variant.create({ productId: product.id, sku: 'CC-1', label: '16', weightGrams: 3, effectiveWeight: 3, stockQty: 50, purity: '22k', isActive: true })
  await ProductImage.create({ productId: product.id, imageUrl: 'https://cdn.example.com/c.jpg', isPrimary: true, displayOrder: 0 })
  await Coupon.create({
    code: 'ONCE',
    discountType: 'flat',
    discountValue: 10,
    usageLimit: 1,
    perCustomerLimit: 1,
    usedCount: 0,
    isActive: true,
    validFrom: new Date(Date.now() - 1000),
  })
})

async function place(customer, address, key, code = 'ONCE') {
  await CartItem.findOneAndUpdate(
    { customerId: customer.id, variantId: variant.id, customizationKey: '' },
    { $set: { qty: 1, customizationKey: '', customizationRequest: null } },
    { upsert: true },
  )
  return orderService.placeOrder(customer.id, {
    address_id: address.id,
    payment_method: 'cod',
    wallet_use: 0,
    coupon_code: code,
    idempotency_key: key,
  })
}

describe('coupon concurrency and snapshot', () => {
  it('allows only one concurrent redemption when usageLimit is 1', async () => {
    const results = await Promise.allSettled([
      place(customerA, addressA, 'c-a'),
      place(customerB, addressB, 'c-b'),
    ])
    const ok = results.filter((item) => item.status === 'fulfilled')
    const fail = results.filter((item) => item.status === 'rejected')
    expect(ok).toHaveLength(1)
    expect(fail).toHaveLength(1)
    expect(['COUPON_USAGE_LIMIT', 'COUPON_INVALID']).toContain(fail[0].reason.code)
    expect(await CouponRedemption.countDocuments({ status: 'active' })).toBe(1)
    expect((await Coupon.findOne({ code: 'ONCE' })).usedCount).toBe(1)
  })

  it('keeps accepted coupon discount after coupon is deactivated (repricing path)', async () => {
    const order = await place(customerA, addressA, 'snap-1')
    expect(order.couponSnapshot?.code).toBe('ONCE')
    await Coupon.updateOne({ code: 'ONCE' }, { $set: { isActive: false } })
    order.status = 'shipped'
    await order.save()
    const paid = await orderService.finalizeCodHandover(order.id, staff.id, { amount_collected: Number(order.total) })
    expect(paid.discountAmount).toBe(10)
    expect(paid.paymentStatus).toBe('paid')
  })

  it('rolls back capacity so another customer can use the coupon after cancel', async () => {
    const order = await place(customerA, addressA, 'roll-1')
    await orderService.cancelOrder(order.id, staff.id, 'cancel')
    expect((await Coupon.findOne({ code: 'ONCE' })).usedCount).toBe(0)
    const second = await place(customerB, addressB, 'roll-2')
    expect(second.couponCode).toBe('ONCE')
  })

  it('racing redemption vs usage_limit reduction yields one valid outcome', async () => {
    const coupon = await Coupon.create({
      code: 'RACEUL',
      discountType: 'flat',
      discountValue: 10,
      usageLimit: 2,
      perCustomerLimit: 5,
      usedCount: 1,
      isActive: true,
      validFrom: new Date(Date.now() - 1000),
    })
    const seed = await Order.create({
      customerId: customerB.id,
      orderNumber: `ORD-UL-SEED-${Date.now()}`,
      status: 'placed',
      paymentMethod: 'cod',
      paymentStatus: 'cod_pending',
      subtotal: 100,
      discountAmount: 10,
      taxAmount: 0,
      shippingFee: 0,
      total: 90,
      shipTo: { line1: 'L', city: 'Dubai', country: 'UAE' },
      idempotencyKey: `seed-ul-${Date.now()}`,
      couponCode: 'RACEUL',
    })
    await CouponRedemption.create({
      couponId: coupon.id,
      customerId: customerB.id,
      orderId: seed.id,
      discountAmount: 10,
      status: 'active',
    })

    const results = await Promise.allSettled([
      place(customerA, addressA, 'race-ul-place', 'RACEUL'),
      adminService.updateCoupon(coupon.id, { usage_limit: 1 }),
    ])

    const placeRes = results[0]
    const adminRes = results[1]
    const placeOk = placeRes.status === 'fulfilled'
    const adminOk = adminRes.status === 'fulfilled'
    // At most one of the contested operations may "win" the remaining slot.
    expect(placeOk && adminOk).toBe(false)

    const final = await Coupon.findById(coupon.id)
    const activeCount = await CouponRedemption.countDocuments({ couponId: coupon.id, status: 'active' })
    expect(final.usedCount).toBeGreaterThanOrEqual(0)
    expect(final.usageLimit == null || final.usedCount <= final.usageLimit).toBe(true)
    expect(final.usedCount).toBe(activeCount)

    if (!adminOk) {
      expect(adminRes.reason).toBeInstanceOf(AppError)
      expect(adminRes.reason.code).toBe('COUPON_USAGE_LIMIT_TOO_LOW')
      expect(placeOk).toBe(true)
      expect(final.usedCount).toBe(2)
      expect(final.usageLimit).toBe(2)
    } else {
      expect(placeOk).toBe(false)
      expect(['COUPON_USAGE_LIMIT', 'COUPON_INVALID']).toContain(placeRes.reason.code)
      expect(final.usageLimit).toBe(1)
      expect(final.usedCount).toBe(1)
    }
  })

  it('racing redemption vs per_customer_limit reduction yields one valid outcome', async () => {
    const coupon = await Coupon.create({
      code: 'RACEPC',
      discountType: 'flat',
      discountValue: 10,
      usageLimit: 10,
      perCustomerLimit: 2,
      usedCount: 1,
      isActive: true,
      validFrom: new Date(Date.now() - 1000),
    })
    await CouponCustomerUsage.create({
      couponId: coupon.id,
      customerId: customerA.id,
      activeCount: 1,
    })
    const seed = await Order.create({
      customerId: customerA.id,
      orderNumber: `ORD-SEED-${Date.now()}`,
      status: 'placed',
      paymentMethod: 'cod',
      paymentStatus: 'cod_pending',
      subtotal: 100,
      discountAmount: 10,
      taxAmount: 0,
      shippingFee: 0,
      total: 90,
      shipTo: { line1: 'L', city: 'Dubai', country: 'UAE' },
      idempotencyKey: `seed-pc-${Date.now()}`,
      couponCode: 'RACEPC',
    })
    await CouponRedemption.create({
      couponId: coupon.id,
      customerId: customerA.id,
      orderId: seed.id,
      discountAmount: 10,
      status: 'active',
    })

    const results = await Promise.allSettled([
      place(customerA, addressA, 'race-pc-place', 'RACEPC'),
      adminService.updateCoupon(coupon.id, { per_customer_limit: 1 }),
    ])

    const placeRes = results[0]
    const adminRes = results[1]
    const placeOk = placeRes.status === 'fulfilled'
    const adminOk = adminRes.status === 'fulfilled'

    const final = await Coupon.findById(coupon.id)
    const usage = await CouponCustomerUsage.findOne({ couponId: coupon.id, customerId: customerA.id })
    const activeReds = await CouponRedemption.countDocuments({ couponId: coupon.id, status: 'active' })

    expect(usage.activeCount).toBeLessThanOrEqual(final.perCustomerLimit)
    expect(final.usageLimit == null || final.usedCount <= final.usageLimit).toBe(true)
    expect(final.usedCount).toBe(activeReds)
    expect(final.usedCount).toBeGreaterThanOrEqual(1)

    // Exactly one side wins the contested per-customer slot.
    expect(placeOk && adminOk).toBe(false)

    if (!adminOk) {
      expect(adminRes.reason.code).toBe('COUPON_CUSTOMER_LIMIT_TOO_LOW')
      expect(placeOk).toBe(true)
      expect(usage.activeCount).toBe(2)
      expect(final.perCustomerLimit).toBe(2)
    } else {
      expect(placeOk).toBe(false)
      expect(['COUPON_CUSTOMER_LIMIT', 'COUPON_INVALID', 'COUPON_USAGE_LIMIT']).toContain(placeRes.reason.code)
      expect(final.perCustomerLimit).toBe(1)
      expect(usage.activeCount).toBe(1)
    }
  })
})
