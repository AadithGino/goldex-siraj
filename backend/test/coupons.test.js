import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Customer, Staff } from '../src/models/auth.models.js'
import { Brand, Category, Product, ProductImage, StoreSetting, TaxSetting, Variant } from '../src/models/catalog.models.js'
import { Address, CartItem, Coupon, CouponRedemption } from '../src/models/commerce.models.js'
import { GoldRate } from '../src/models/rate.models.js'
import { hashPassword } from '../src/services/auth.service.js'
import * as adminService from '../src/services/admin.service.js'
import * as orderService from '../src/services/order.service.js'
import { validateCoupon } from '../src/services/pricing.service.js'
import { AppError } from '../src/utils/AppError.js'

let mongoServer
let customer
let staff
let address
let variant
let coupon

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-coupons-test'))
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  const collections = mongoose.connection.collections
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})))

  await StoreSetting.create({ singleton: 'default', codEnabled: true, bankTransferEnabled: true, shippingFee: 25, freeShippingThreshold: 1000 })
  await TaxSetting.create({ singleton: 'default', isActive: true, taxPercent: 5, taxMode: 'exclusive', applyOn: 'total' })
  await GoldRate.create({ purity: '22k', ratePerGram: 250, isCurrent: true, effectiveAt: new Date() })

  customer = await Customer.create({
    phone: '+971501000222',
    fullName: 'Coupon Buyer',
    email: 'coupon.buyer@example.com',
    authProvider: 'otp',
  })
  staff = await Staff.create({
    fullName: 'Coupon Admin',
    email: 'coupon-admin@example.com',
    passwordHash: await hashPassword('password-12345678'),
    role: 'manager',
  })
  address = await Address.create({
    customerId: customer.id,
    recipientName: 'Coupon Buyer',
    phone: '+971501000222',
    line1: 'Marina Walk',
    city: 'Dubai',
    state: 'Dubai',
    country: 'United Arab Emirates',
  })

  const brand = await Brand.create({ name: 'Goldex', slug: 'goldex-c', isActive: true })
  const category = await Category.create({ name: 'Rings', slug: 'rings-c', isActive: true })
  const product = await Product.create({
    name: 'Coupon Ring',
    nameAr: 'خاتم',
    slug: 'coupon-ring',
    brandId: brand.id,
    categoryId: category.id,
    status: 'active',
    metalType: 'gold',
    metalColor: 'yellow',
    purity: '22k',
  })
  variant = await Variant.create({
    productId: product.id,
    sku: 'RING-C-01',
    label: 'Size 16',
    labelAr: 'مقاس 16',
    weightGrams: 4,
    effectiveWeight: 3.8,
    stockQty: 20,
    purity: '22k',
    isActive: true,
  })
  await ProductImage.create({
    productId: product.id,
    imageUrl: 'https://cdn.example.com/ring.jpg',
    isPrimary: true,
    displayOrder: 0,
  })

  coupon = await Coupon.create({
    code: 'FLAT10',
    discountType: 'flat',
    discountValue: 30.55,
    minOrder: 0,
    usageLimit: 100,
    perCustomerLimit: 1,
    usedCount: 0,
    isActive: true,
    validFrom: new Date(Date.now() - 60_000),
  })
})

async function seedCart(qty = 1) {
  await CartItem.create({ customerId: customer.id, variantId: variant.id, qty })
}

async function placeWithCoupon(key) {
  await seedCart(1)
  return orderService.placeOrder(customer.id, {
    address_id: address.id,
    payment_method: 'cod',
    wallet_use: 0,
    coupon_code: 'FLAT10',
    idempotency_key: key,
  })
}

describe('coupon redemptions and analytics', () => {
  it('creates one active redemption and correct usage summary/detail on place', async () => {
    const order = await placeWithCoupon('coupon-place-1')
    const redemptions = await CouponRedemption.find({ couponId: coupon.id })
    expect(redemptions).toHaveLength(1)
    expect(redemptions[0].status).toBe('active')
    expect(redemptions[0].discountAmount).toBe(30.55)

    const refreshed = await Coupon.findById(coupon.id)
    expect(refreshed.usedCount).toBe(1)

    const summary = await adminService.couponUsageSummary()
    const row = summary.find((item) => String(item.coupon_id) === String(coupon.id))
    expect(row).toMatchObject({
      code: 'FLAT10',
      active_usage_count: 1,
      rolled_back_count: 0,
      unique_customer_count: 1,
      lifetime_usage_count: 1,
    })
    expect(row.total_active_discount).toBeCloseTo(30.55, 2)
    expect(row.lifetime_discount).toBeCloseTo(30.55, 2)

    const usage = await adminService.couponUsage(coupon.id)
    expect(usage.items).toHaveLength(1)
    expect(usage.items[0]).toMatchObject({
      coupon_code: 'FLAT10',
      customer_name: 'Coupon Buyer',
      customer_phone: '+971501000222',
      customer_email: 'coupon.buyer@example.com',
      order_number: order.orderNumber,
      order_status: order.status,
      payment_status: order.paymentStatus,
      discount_amount: 30.55,
      status: 'active',
    })
    expect(usage.items[0].order_id).toBe(String(order.id))
    expect(usage.items[0].customer_id).toBe(String(customer.id))
  })

  it('does not create another redemption on idempotent retry', async () => {
    await placeWithCoupon('coupon-idem-1')
    await placeWithCoupon('coupon-idem-1')
    expect(await CouponRedemption.countDocuments({ couponId: coupon.id })).toBe(1)
    expect((await Coupon.findById(coupon.id)).usedCount).toBe(1)
  })

  it('rolls back redemption on cancel, preserves history, and decrements usedCount once', async () => {
    const order = await placeWithCoupon('coupon-cancel-1')
    await orderService.cancelOrder(order.id, staff.id, 'Customer requested cancel')

    const redemptions = await CouponRedemption.find({ couponId: coupon.id })
    expect(redemptions).toHaveLength(1)
    expect(redemptions[0].status).toBe('rolled_back')
    expect(redemptions[0].rollbackReason).toBe('Customer requested cancel')
    expect(String(redemptions[0].rolledBackBy)).toBe(String(staff.id))
    expect((await Coupon.findById(coupon.id)).usedCount).toBe(0)

    await orderService.cancelOrder(order.id, staff.id, 'Retry cancel')
    expect((await Coupon.findById(coupon.id)).usedCount).toBe(0)
    expect(await CouponRedemption.countDocuments({ couponId: coupon.id })).toBe(1)

    const summary = await adminService.couponUsageSummary()
    const row = summary.find((item) => String(item.coupon_id) === String(coupon.id))
    expect(row.active_usage_count).toBe(0)
    expect(row.rolled_back_count).toBe(1)
    expect(row.unique_customer_count).toBe(0)
    expect(row.total_active_discount).toBe(0)
    expect(row.total_rolled_back_discount).toBeCloseTo(30.55, 2)
    expect(row.lifetime_usage_count).toBe(1)
  })

  it('does not consume per-customer limit after rollback', async () => {
    coupon.perCustomerLimit = 1
    await coupon.save()

    const order = await placeWithCoupon('coupon-limit-1')
    let validation = await validateCoupon('FLAT10', 500, customer.id)
    expect(validation.valid).toBe(false)
    expect(validation.reason).toBe('customer_limit_reached')

    await orderService.cancelOrder(order.id, staff.id, 'Undo')
    validation = await validateCoupon('FLAT10', 500, customer.id)
    expect(validation.valid).toBe(true)
  })

  it('archives coupon with history instead of hard deleting', async () => {
    await placeWithCoupon('coupon-archive-1')
    const result = await adminService.deleteCoupon(coupon.id)
    expect(result.archived).toBe(true)
    expect(result.deleted).toBe(false)
    expect(await Coupon.findById(coupon.id)).toBeTruthy()
    expect((await Coupon.findById(coupon.id)).isActive).toBe(false)
    expect(await CouponRedemption.countDocuments({ couponId: coupon.id })).toBe(1)
  })

  it('hard-deletes coupon with no redemptions', async () => {
    const unused = await Coupon.create({
      code: 'UNUSED1',
      discountType: 'flat',
      discountValue: 5,
      isActive: true,
      validFrom: new Date(Date.now() - 1000),
    })
    const result = await adminService.deleteCoupon(unused.id)
    expect(result.deleted).toBe(true)
    expect(await Coupon.findById(unused.id)).toBeNull()
  })

  it('returns 404 for invalid/missing coupon usage id and empty array when unused', async () => {
    await expect(adminService.couponUsage('not-an-id')).rejects.toMatchObject({ code: 'COUPON_NOT_FOUND' })
    await expect(adminService.couponUsage(new mongoose.Types.ObjectId().toString())).rejects.toBeInstanceOf(AppError)

    const unused = await Coupon.create({
      code: 'EMPTY1',
      discountType: 'percent',
      discountValue: 10,
      isActive: true,
      validFrom: new Date(Date.now() - 1000),
    })
    await expect(adminService.couponUsage(unused.id)).resolves.toMatchObject({ items: [], total: 0 })
  })

  it('keeps usage rows when related customer/order documents are missing', async () => {
    await placeWithCoupon('coupon-orphan-1')
    const redemption = await CouponRedemption.findOne({ couponId: coupon.id })
    await Customer.deleteOne({ _id: customer.id })
    await mongoose.model('Order').deleteOne({ _id: redemption.orderId })

    const usage = await adminService.couponUsage(coupon.id)
    expect(usage.items).toHaveLength(1)
    expect(usage.items[0].customer_name).toBeNull()
    expect(usage.items[0].order_number).toBeNull()
    expect(usage.items[0].discount_amount).toBe(30.55)
    expect(usage.items[0].status).toBe('active')
  })

  it('uses the real CouponRedemption collection name in summary lookup', async () => {
    expect(CouponRedemption.collection.name).toBe('couponredemptions')
    await placeWithCoupon('coupon-coll-1')
    const summary = await adminService.couponUsageSummary()
    expect(summary.find((item) => item.code === 'FLAT10')?.active_usage_count).toBe(1)
  })
})
