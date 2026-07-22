/**
 * Phase 22.5 — Coupon mutation / date / usage HTTP contracts.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import app from '../src/app.js'
import { Customer, Staff } from '../src/models/auth.models.js'
import { Brand, Category, Product, ProductImage, StoreSetting, TaxSetting, Variant } from '../src/models/catalog.models.js'
import { Address, CartItem, Coupon, Order } from '../src/models/commerce.models.js'
import { GoldRate } from '../src/models/rate.models.js'
import { hashPassword, issueSession } from '../src/services/auth.service.js'
import { SESSION_COOKIES } from '../src/utils/sessionCookies.js'

let mongoServer
let staffCookie
let customerCookie
let customer
let address
let variant22
let variant24

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
}

/** Mirrors frontend toCouponPayload output (ISO dates). */
function toCouponPayload(input = {}) {
  const discountValue = Number(input.discount_value)
  const minOrderRaw = Number(input.min_order)
  const maxRaw = input.max_discount === '' || input.max_discount == null ? null : Number(input.max_discount)
  const usageRaw = input.usage_limit === '' || input.usage_limit == null ? null : Number(input.usage_limit)
  const perCustomer = Number(input.per_customer_limit)
  return {
    code: String(input.code ?? '').trim().toUpperCase(),
    discount_type: input.discount_type === 'flat' ? 'flat' : 'percent',
    discount_value: discountValue,
    min_order: Number.isFinite(minOrderRaw) && minOrderRaw >= 0 ? minOrderRaw : 0,
    max_discount: maxRaw != null && maxRaw > 0 ? maxRaw : null,
    usage_limit: usageRaw != null && usageRaw >= 1 ? Math.trunc(usageRaw) : null,
    per_customer_limit: Number.isFinite(perCustomer) && perCustomer >= 1 ? Math.trunc(perCustomer) : 1,
    valid_from: input.valid_from ?? null,
    valid_to: input.valid_to ?? null,
    is_active: input.is_active === true,
  }
}

const nowIso = () => new Date(Date.now() - 60_000).toISOString()
const futureIso = () => new Date(Date.now() + 7 * 24 * 3600_000).toISOString()

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-coupon-contract'))
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})))
  await StoreSetting.create({
    singleton: 'default',
    codEnabled: true,
    bankTransferEnabled: true,
    shippingFee: 0,
    freeShippingThreshold: 0,
  })
  await TaxSetting.create({ singleton: 'default', isActive: true, taxPercent: 5, taxMode: 'exclusive', applyOn: 'total' })
  await GoldRate.create({ purity: '22k', ratePerGram: 250, isCurrent: true, effectiveAt: new Date() })
  await GoldRate.create({ purity: '24k', ratePerGram: 300, isCurrent: true, effectiveAt: new Date() })

  const staff = await Staff.create({
    fullName: 'Coupon Manager',
    email: 'coupon-mgr@example.com',
    passwordHash: await hashPassword('password-12345678'),
    role: 'manager',
    isActive: true,
  })
  const staffTokens = await issueSession(staff, 'staff')
  staffCookie = cookieHeader({
    [SESSION_COOKIES.staffAccess]: staffTokens.accessToken,
    [SESSION_COOKIES.staffRefresh]: staffTokens.refreshToken,
  })

  customer = await Customer.create({
    phone: '+971501777001',
    fullName: 'Coupon Shopper',
    email: 'coupon.shopper@example.com',
    authProvider: 'otp',
    isActive: true,
  })
  const customerTokens = await issueSession(customer, 'customer')
  customerCookie = cookieHeader({
    [SESSION_COOKIES.customerAccess]: customerTokens.accessToken,
    [SESSION_COOKIES.customerRefresh]: customerTokens.refreshToken,
  })

  address = await Address.create({
    customerId: customer.id,
    recipientName: 'Coupon Shopper',
    phone: '501777001',
    line1: 'Test St',
    city: 'Dubai',
    state: 'Dubai',
    country: 'United Arab Emirates',
    isDefault: true,
  })

  const brand = await Brand.create({ name: 'CBrand', slug: 'cbrand', isActive: true })
  const category = await Category.create({ name: 'CCat', slug: 'ccat', isActive: true })
  const p22 = await Product.create({
    name: '22K Ring',
    slug: 'ring-22-c',
    brandId: brand.id,
    categoryId: category.id,
    status: 'active',
    metalType: 'gold',
    purity: '22k',
    taxTreatment: 'standard',
  })
  const p24 = await Product.create({
    name: '24K Bar',
    slug: 'bar-24-c',
    brandId: brand.id,
    categoryId: category.id,
    status: 'active',
    metalType: 'gold',
    purity: '24k',
    taxTreatment: 'zero_rated',
  })
  variant22 = await Variant.create({
    productId: p22.id, sku: 'C-22', label: '16', weightGrams: 4, effectiveWeight: 4,
    stockQty: 50, purity: '22k', isActive: true, taxTreatment: 'standard',
  })
  variant24 = await Variant.create({
    productId: p24.id, sku: 'C-24', label: '10g', weightGrams: 10, effectiveWeight: 10,
    stockQty: 50, purity: '24k', isActive: true, taxTreatment: 'zero_rated',
  })
  await ProductImage.create({ productId: p22.id, imageUrl: 'https://cdn.example.com/a.jpg', isPrimary: true })
  await ProductImage.create({ productId: p24.id, imageUrl: 'https://cdn.example.com/b.jpg', isPrimary: true })
})

describe('Phase 22.5 coupon write contract', () => {
  it('creates with exact FE payload; persists Dates and snake_case GET', async () => {
    const payload = toCouponPayload({
      code: 'save10',
      discount_type: 'percent',
      discount_value: 10,
      min_order: 100,
      max_discount: 50,
      usage_limit: 20,
      per_customer_limit: 2,
      valid_from: nowIso(),
      valid_to: futureIso(),
      is_active: true,
    })

    const createRes = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .send(payload)

    expect(createRes.status).toBe(201)
    expect(createRes.body.data.code).toBe('SAVE10')
    expect(createRes.body.data.discount_type).toBe('percent')
    expect(createRes.body.data.discount_value).toBe(10)
    expect(createRes.body.data.min_order).toBe(100)
    expect(createRes.body.data.max_discount).toBe(50)
    expect(createRes.body.data.usage_limit).toBe(20)
    expect(createRes.body.data.per_customer_limit).toBe(2)
    expect(createRes.body.data.is_active).toBe(true)
    expect(createRes.body.data.valid_from).toMatch(/Z$/)
    expect(createRes.body.data.valid_to).toMatch(/Z$/)

    const db = await Coupon.findById(createRes.body.data.id)
    expect(db.validFrom).toBeInstanceOf(Date)
    expect(db.validTo).toBeInstanceOf(Date)
    expect(db.discountType).toBe('percent')
    expect(db.minOrder).toBe(100)
    expect(db.usedCount).toBe(0)

    const getList = await request(app)
      .get('/api/v1/admin/coupons')
      .query({ search: 'SAVE10' })
      .set('Cookie', staffCookie)
    expect(getList.status).toBe(200)
    expect(getList.body.data.some((c) => c.code === 'SAVE10')).toBe(true)
    expect(getList.body.meta).toBeTruthy()
  })

  it('updates with FE payload and preserves is_active false', async () => {
    const created = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .send(toCouponPayload({
        code: 'UPD1',
        discount_type: 'flat',
        discount_value: 25,
        valid_from: nowIso(),
        valid_to: null,
        is_active: true,
      }))
    const id = created.body.data.id

    const patch = toCouponPayload({
      code: 'UPD1',
      discount_type: 'flat',
      discount_value: 40,
      min_order: 50,
      max_discount: null,
      usage_limit: null,
      per_customer_limit: 1,
      valid_from: nowIso(),
      valid_to: futureIso(),
      is_active: false,
    })

    const res = await request(app)
      .patch(`/api/v1/admin/coupons/${id}`)
      .set('Cookie', staffCookie)
      .send(patch)

    expect(res.status).toBe(200)
    expect(res.body.data.discount_value).toBe(40)
    expect(res.body.data.is_active).toBe(false)
    expect(res.body.data.usage_limit).toBeNull()
  })

  it('rejects empty PATCH, unknown fields, conflicts, missing create, percent>100, bad dates, timezone-less, used_count', async () => {
    const created = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .send(toCouponPayload({
        code: 'RULES',
        discount_type: 'percent',
        discount_value: 10,
        valid_from: nowIso(),
        is_active: true,
      }))
    const id = created.body.data.id

    expect((await request(app).patch(`/api/v1/admin/coupons/${id}`).set('Cookie', staffCookie).send({})).status).toBe(422)

    expect((await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .send({ ...toCouponPayload({ code: 'X', discount_type: 'flat', discount_value: 5, valid_from: nowIso(), is_active: true }), description: 'nope' })).status).toBe(422)

    expect((await request(app)
      .patch(`/api/v1/admin/coupons/${id}`)
      .set('Cookie', staffCookie)
      .send({ discount_type: 'percent', type: 'flat' })).status).toBe(422)

    expect((await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .send({ discount_type: 'percent', discount_value: 10, valid_from: nowIso() })).status).toBe(422)

    expect((await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .send(toCouponPayload({
        code: 'OVER',
        discount_type: 'percent',
        discount_value: 150,
        valid_from: nowIso(),
        is_active: true,
      }))).status).toBe(422)

    expect((await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .send(toCouponPayload({
        code: 'RANGE',
        discount_type: 'flat',
        discount_value: 5,
        valid_from: futureIso(),
        valid_to: nowIso(),
        is_active: true,
      }))).status).toBe(422)

    expect((await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .send({
        code: 'NAIVE',
        discount_type: 'flat',
        discount_value: 5,
        valid_from: '2026-07-21T14:00',
        is_active: true,
      })).status).toBe(422)

    expect((await request(app)
      .patch(`/api/v1/admin/coupons/${id}`)
      .set('Cookie', staffCookie)
      .send({ used_count: 99 })).status).toBe(422)
  })

  it('duplicate code → 409; unauthorized cannot mutate; limit cannot go below usage', async () => {
    await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .send(toCouponPayload({
        code: 'DUP',
        discount_type: 'flat',
        discount_value: 5,
        valid_from: nowIso(),
        is_active: true,
      }))

    const dup = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .send(toCouponPayload({
        code: 'dup',
        discount_type: 'flat',
        discount_value: 5,
        valid_from: nowIso(),
        is_active: true,
      }))
    expect(dup.status).toBe(409)
    expect(dup.body.error.code).toBe('DUPLICATE_RESOURCE')

    expect([401, 403]).toContain((await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', customerCookie)
      .send(toCouponPayload({
        code: 'NOPE',
        discount_type: 'flat',
        discount_value: 5,
        valid_from: nowIso(),
        is_active: true,
      }))).status)

    const limited = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .send(toCouponPayload({
        code: 'LIM',
        discount_type: 'flat',
        discount_value: 10,
        usage_limit: 5,
        valid_from: nowIso(),
        is_active: true,
      }))
    await Coupon.findByIdAndUpdate(limited.body.data.id, { usedCount: 3 })

    const tooLow = await request(app)
      .patch(`/api/v1/admin/coupons/${limited.body.data.id}`)
      .set('Cookie', staffCookie)
      .send({ usage_limit: 2 })
    expect(tooLow.status).toBe(409)
    expect(tooLow.body.error.code).toBe('COUPON_USAGE_LIMIT_TOO_LOW')
  })
})

describe('Phase 22.5 coupon validate / checkout / VAT', () => {
  async function createActiveCoupon(overrides = {}) {
    const res = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .send(toCouponPayload({
        code: 'CHECK',
        discount_type: 'percent',
        discount_value: 10,
        max_discount: 100,
        min_order: 0,
        usage_limit: 10,
        per_customer_limit: 5,
        valid_from: nowIso(),
        valid_to: futureIso(),
        is_active: true,
        ...overrides,
      }))
    expect(res.status).toBe(201)
    return res.body.data
  }

  it('customer validation enforces active/from/to/min/limits and percent cap', async () => {
    const coupon = await createActiveCoupon({ code: 'VAL', discount_type: 'percent', discount_value: 50, max_discount: 40 })

    const ok = await request(app)
      .post('/api/v1/customer/coupons/validate')
      .set('Cookie', customerCookie)
      .send({ code: 'VAL', order_total: 200 })
    expect(ok.status).toBe(200)
    expect(ok.body.data.valid).toBe(true)
    expect(ok.body.data.discount_amount).toBe(40)

    await Coupon.findByIdAndUpdate(coupon.id, { isActive: false })
    const inactive = await request(app)
      .post('/api/v1/customer/coupons/validate')
      .set('Cookie', customerCookie)
      .send({ code: 'VAL', order_total: 200 })
    expect(inactive.body.data.valid).toBe(false)

    await Coupon.findByIdAndUpdate(coupon.id, {
      isActive: true,
      validFrom: new Date(Date.now() + 3600_000),
    })
    const future = await request(app)
      .post('/api/v1/customer/coupons/validate')
      .set('Cookie', customerCookie)
      .send({ code: 'VAL', order_total: 200 })
    expect(future.body.data.valid).toBe(false)

    await Coupon.findByIdAndUpdate(coupon.id, {
      validFrom: new Date(Date.now() - 3600_000),
      validTo: new Date(Date.now() - 1000),
    })
    const expired = await request(app)
      .post('/api/v1/customer/coupons/validate')
      .set('Cookie', customerCookie)
      .send({ code: 'VAL', order_total: 200 })
    expect(expired.body.data.valid).toBe(false)

    await Coupon.findByIdAndUpdate(coupon.id, {
      validTo: new Date(Date.now() + 86400_000),
      minOrder: 500,
      discountType: 'flat',
      discountValue: 30,
      maxDiscount: null,
    })
    const minFail = await request(app)
      .post('/api/v1/customer/coupons/validate')
      .set('Cookie', customerCookie)
      .send({ code: 'VAL', order_total: 100 })
    expect(minFail.body.data.valid).toBe(false)
    expect(minFail.body.data.reason).toBe('minimum_order_not_met')

    const flatOk = await request(app)
      .post('/api/v1/customer/coupons/validate')
      .set('Cookie', customerCookie)
      .send({ code: 'VAL', order_total: 600 })
    expect(flatOk.body.data.valid).toBe(true)
    expect(flatOk.body.data.discount_amount).toBe(30)
  })

  it('order redemption, usage detail, rollback once, archive vs delete, snapshot immutable', async () => {
    const coupon = await createActiveCoupon({
      code: 'FLAT15',
      discount_type: 'flat',
      discount_value: 15,
      max_discount: null,
    })

    const { placeOrder, cancelOrder } = await import('../src/services/order.service.js')
    await CartItem.create({ customerId: customer.id, variantId: variant22.id, qty: 1 })
    const order = await placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'cod',
      coupon_code: 'FLAT15',
      idempotency_key: 'coupon-contract-place-1',
    })

    const usage = await request(app)
      .get(`/api/v1/admin/coupons/${coupon.id}/usage`)
      .set('Cookie', staffCookie)
    expect(usage.status).toBe(200)
    expect(usage.body.data).toHaveLength(1)
    expect(usage.body.data[0]).toMatchObject({
      customer_name: 'Coupon Shopper',
      customer_phone: '+971501777001',
      customer_email: 'coupon.shopper@example.com',
      order_id: String(order.id),
      order_number: order.orderNumber,
      status: 'active',
    })

    const summary = await request(app)
      .get('/api/v1/admin/coupons/usage-summary')
      .set('Cookie', staffCookie)
    const row = summary.body.data.find((r) => String(r.coupon_id) === String(coupon.id))
    expect(row.active_usage_count).toBe(1)
    expect(row.unique_customer_count).toBe(1)

    await request(app)
      .patch(`/api/v1/admin/coupons/${coupon.id}`)
      .set('Cookie', staffCookie)
      .send({ discount_value: 99 })
    const orderAfter = await Order.findById(order.id)
    expect(orderAfter.couponSnapshot.discountValue).toBe(15)
    expect(Number(orderAfter.discountAmount)).toBeCloseTo(15, 2)

    const staff = await Staff.findOne({ email: 'coupon-mgr@example.com' })
    await cancelOrder(order.id, staff.id, 'test cancel')
    expect((await Coupon.findById(coupon.id)).usedCount).toBe(0)

    const usageAfter = await request(app)
      .get(`/api/v1/admin/coupons/${coupon.id}/usage`)
      .set('Cookie', staffCookie)
    expect(usageAfter.body.data[0].status).toBe('rolled_back')

    await cancelOrder(order.id, staff.id, 'retry')
    expect((await Coupon.findById(coupon.id)).usedCount).toBe(0)

    const delUsed = await request(app)
      .delete(`/api/v1/admin/coupons/${coupon.id}`)
      .set('Cookie', staffCookie)
    expect(delUsed.status).toBe(200)
    expect(delUsed.body.data.archived).toBe(true)

    const unused = await createActiveCoupon({ code: 'UNUSED99', discount_type: 'flat', discount_value: 1 })
    const delUnused = await request(app)
      .delete(`/api/v1/admin/coupons/${unused.id}`)
      .set('Cookie', staffCookie)
    expect(delUnused.body.data.deleted).toBe(true)
    expect(await Coupon.findById(unused.id)).toBeNull()
  })

  it('24KT-only coupon cart keeps VAT at 0; mixed cart taxes only 22KT', async () => {
    await createActiveCoupon({
      code: 'VATTEST',
      discount_type: 'flat',
      discount_value: 50,
      max_discount: null,
    })

    await CartItem.create({ customerId: customer.id, variantId: variant24.id, qty: 1 })
    const q24 = await request(app)
      .post('/api/v1/customer/cart/quote')
      .set('Cookie', customerCookie)
      .send({ coupon_code: 'VATTEST' })
    expect(q24.status).toBe(200)
    const lines24 = q24.body.data.lines
    expect(Array.isArray(lines24)).toBe(true)
    expect(lines24.length).toBe(1)
    const only24 = lines24.find((l) => String(l.variant_id) === String(variant24.id))
    expect(only24).toBeTruthy()
    expect(only24.breakup).toBeTruthy()
    expect(only24.breakup.tax_treatment).toBe('zero_rated')
    expect(Number(only24.breakup.tax_rate)).toBe(0)
    expect(Number(only24.breakup.vat_amount)).toBe(0)
    expect(Number(q24.body.data.totals.tax_amount)).toBe(0)

    await CartItem.deleteMany({ customerId: customer.id })
    await CartItem.create({ customerId: customer.id, variantId: variant24.id, qty: 1 })
    await CartItem.create({ customerId: customer.id, variantId: variant22.id, qty: 1 })
    const qMix = await request(app)
      .post('/api/v1/customer/cart/quote')
      .set('Cookie', customerCookie)
      .send({ coupon_code: 'VATTEST' })
    expect(qMix.status).toBe(200)
    const mixLines = qMix.body.data.lines
    expect(Array.isArray(mixLines)).toBe(true)
    expect(mixLines).toHaveLength(2)
    const line22 = mixLines.find((l) => String(l.variant_id) === String(variant22.id))
    const line24 = mixLines.find((l) => String(l.variant_id) === String(variant24.id))
    expect(line24).toBeTruthy()
    expect(line24.breakup).toBeTruthy()
    expect(line22).toBeTruthy()
    expect(line22.breakup).toBeTruthy()
    expect(line24.breakup.tax_treatment).toBe('zero_rated')
    expect(Number(line24.breakup.tax_rate)).toBe(0)
    expect(Number(line24.breakup.vat_amount)).toBe(0)
    expect(line22.breakup.tax_treatment).toBe('standard')
    expect(Number(line22.breakup.taxable_base)).toBeGreaterThan(0)
    expect(Number(line22.breakup.vat_amount)).toBeGreaterThan(0)
    const sumLineVat = roundMoneySum(mixLines.map((l) => Number(l.breakup.vat_amount)))
    expect(Number(qMix.body.data.totals.tax_amount)).toBe(sumLineVat)
    const couponDiscount = Number(qMix.body.data.totals.discount_amount)
    expect(couponDiscount).toBe(50)
    const allocated = roundMoneySum(mixLines.map((l) => Number(l.breakup.discount_amount)))
    expect(allocated).toBe(couponDiscount)
    const t = qMix.body.data.totals
    const subtotal = Number(t.subtotal)
    const discount = Number(t.discount_amount)
    const vat = Number(t.tax_amount)
    const shipping = Number(t.shipping_fee)
    const finalTotal = Number(t.total)
    expect(finalTotal).toBe(roundMoneySum([subtotal - discount, vat, shipping]))
    expect(line24.breakup.tax_treatment).toBe('zero_rated')
  })

  it('persists every supported legacy alias group onto correct Mongoose fields', async () => {
    const cases = [
      {
        label: 'type+value',
        body: {
          code: 'ALIAS_TYPE',
          type: 'percent',
          value: 12,
          min_order: 10,
          per_customer_limit: 1,
          valid_from: '2026-07-01T00:00:00+04:00',
          is_active: true,
        },
        assert: (doc) => {
          expect(doc.discountType).toBe('percent')
          expect(doc.discountValue).toBe(12)
          expect(doc.minOrder).toBe(10)
        },
      },
      {
        label: 'min_order_amount',
        body: {
          code: 'ALIAS_MIN',
          discount_type: 'flat',
          discount_value: 5,
          min_order_amount: 99.5,
          per_customer_limit: 1,
          valid_from: '2026-07-01T00:00:00+04:00',
          is_active: true,
        },
        assert: (doc) => expect(doc.minOrder).toBe(99.5),
      },
      {
        label: 'minOrderAmount camel',
        body: {
          code: 'ALIAS_MIN_CAMEL',
          discountType: 'flat',
          discountValue: 5,
          minOrderAmount: 88,
          perCustomerLimit: 2,
          validFrom: '2026-07-01T00:00:00+04:00',
          isActive: true,
        },
        assert: (doc) => {
          expect(doc.minOrder).toBe(88)
          expect(doc.perCustomerLimit).toBe(2)
          expect(doc.discountType).toBe('flat')
          expect(doc.discountValue).toBe(5)
          expect(doc.isActive).toBe(true)
        },
      },
      {
        label: 'starts_at/ends_at',
        body: {
          code: 'ALIAS_STARTS',
          discount_type: 'flat',
          discount_value: 3,
          min_order: 0,
          per_customer_limit: 1,
          starts_at: '2026-07-10T00:00:00+04:00',
          ends_at: '2026-07-20T23:59:00+04:00',
          is_active: true,
        },
        assert: (doc) => {
          expect(doc.validFrom.toISOString()).toBe(new Date('2026-07-10T00:00:00+04:00').toISOString())
          expect(doc.validTo.toISOString()).toBe(new Date('2026-07-20T23:59:00+04:00').toISOString())
        },
      },
      {
        label: 'startsAt/endsAt camel',
        body: {
          code: 'ALIAS_STARTS_CAMEL',
          discount_type: 'percent',
          discount_value: 7,
          min_order: 0,
          per_customer_limit: 1,
          startsAt: '2026-08-01T00:00:00+04:00',
          endsAt: '2026-08-31T23:59:00+04:00',
          is_active: true,
        },
        assert: (doc) => {
          expect(doc.validFrom.toISOString()).toBe(new Date('2026-08-01T00:00:00+04:00').toISOString())
          expect(doc.validTo.toISOString()).toBe(new Date('2026-08-31T23:59:00+04:00').toISOString())
        },
      },
    ]

    for (const c of cases) {
      const res = await request(app)
        .post('/api/v1/admin/coupons')
        .set('Cookie', staffCookie)
        .send(c.body)
      expect(res.status, c.label).toBe(201)
      const doc = await Coupon.findById(res.body.data.id)
      expect(doc, c.label).toBeTruthy()
      c.assert(doc)
    }
  })

  it('rejects conflicting aliases, unknown fields, and invalid PATCH date merges', async () => {
    const conflictType = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .send({
        code: 'CONF1',
        type: 'flat',
        discount_type: 'percent',
        value: 5,
        discount_value: 5,
        min_order: 0,
        per_customer_limit: 1,
        valid_from: '2026-07-01T00:00:00+04:00',
        is_active: true,
      })
    expect(conflictType.status).toBe(422)

    const conflictDates = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .send({
        code: 'CONF2',
        discount_type: 'flat',
        discount_value: 5,
        min_order: 0,
        per_customer_limit: 1,
        valid_from: '2026-07-01T00:00:00+04:00',
        starts_at: '2026-07-02T00:00:00+04:00',
        is_active: true,
      })
    expect(conflictDates.status).toBe(422)

    const unknown = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .send({
        code: 'UNK1',
        discount_type: 'flat',
        discount_value: 5,
        min_order: 0,
        per_customer_limit: 1,
        valid_from: '2026-07-01T00:00:00+04:00',
        is_active: true,
        description: 'nope',
      })
    expect(unknown.status).toBe(422)

    const protectedUsed = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .send({
        code: 'PROT1',
        discount_type: 'flat',
        discount_value: 5,
        min_order: 0,
        per_customer_limit: 1,
        valid_from: '2026-07-01T00:00:00+04:00',
        is_active: true,
        used_count: 9,
      })
    expect(protectedUsed.status).toBe(422)

    const pct = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .send({
        code: 'PCT101',
        discount_type: 'percent',
        discount_value: 101,
        min_order: 0,
        per_customer_limit: 1,
        valid_from: '2026-07-01T00:00:00+04:00',
        is_active: true,
      })
    expect(pct.status).toBe(422)

    await createActiveCoupon({ code: 'DUPCODE', discount_type: 'flat', discount_value: 1 })
    const dup = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .send({
        code: 'dupcode',
        discount_type: 'flat',
        discount_value: 1,
        min_order: 0,
        per_customer_limit: 1,
        valid_from: '2026-07-01T00:00:00+04:00',
        is_active: true,
      })
    expect(dup.status).toBe(409)

    const base = await createActiveCoupon({
      code: 'PATCHDATE',
      discount_type: 'flat',
      discount_value: 2,
      valid_from: '2026-07-10T00:00:00+04:00',
      valid_to: '2026-07-20T23:59:00+04:00',
    })
    const clearFrom = await request(app)
      .patch(`/api/v1/admin/coupons/${base.id}`)
      .set('Cookie', staffCookie)
      .send({ valid_from: null })
    expect(clearFrom.status).toBe(422)

    const badRange = await request(app)
      .patch(`/api/v1/admin/coupons/${base.id}`)
      .set('Cookie', staffCookie)
      .send({ valid_to: '2026-07-05T00:00:00+04:00' })
    expect(badRange.status).toBe(422)
  })

  it('usage detail and summary report customer/order/payment fields; rollback is exact-once', async () => {
    const coupon = await createActiveCoupon({
      code: 'USAGEDET',
      discount_type: 'flat',
      discount_value: 25,
      usage_limit: 10,
      per_customer_limit: 5,
    })

    const { placeOrder, cancelOrder } = await import('../src/services/order.service.js')
    await CartItem.create({ customerId: customer.id, variantId: variant22.id, qty: 1 })
    const order = await placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'cod',
      coupon_code: 'USAGEDET',
      idempotency_key: 'usage-detail-1',
    })
    // Attach payment fields expected in usage reporting
    order.paymentMethod = 'cod'
    order.paymentMode = 'cash'
    order.paymentStatus = 'paid'
    order.invoiceNumber = `INV-USAGE-${Date.now()}`
    await order.save()

    const before = await request(app)
      .get(`/api/v1/admin/coupons/${coupon.id}/usage`)
      .set('Cookie', staffCookie)
      .query({ page: 1, limit: 20 })
    expect(before.status).toBe(200)
    expect(before.body.meta).toMatchObject({ page: 1, limit: 20 })
    expect(before.body.meta.total).toBe(1)
    const row = before.body.data[0]
    expect(row.customer_id).toBe(String(customer.id))
    expect(row.customer_name).toBe('Coupon Shopper')
    expect(row.customer_phone).toBe('+971501777001')
    expect(row.customer_email).toBe('coupon.shopper@example.com')
    expect(row.order_id).toBe(String(order.id))
    expect(row.order_number).toBe(order.orderNumber)
    expect(row.order_status).toBe(order.status)
    expect(row.payment_status).toBe('paid')
    expect(row.payment_method).toBe('cod')
    expect(row.payment_mode).toBe('cash')
    expect(row.invoice_number).toBe(order.invoiceNumber)
    expect(Number(row.discount_amount)).toBe(25)
    expect(row.created_at).toBeTruthy()
    expect(row.status).toBe('active')

    const summaryBeforeRes = await request(app)
      .get('/api/v1/admin/coupons/usage-summary')
      .set('Cookie', staffCookie)
    const summaryBefore = summaryBeforeRes.body.data.find((r) => String(r.coupon_id) === String(coupon.id))
    expect(summaryBefore).toMatchObject({
      active_usage_count: 1,
      rolled_back_count: 0,
      unique_customer_count: 1,
      lifetime_usage_count: 1,
    })
    expect(Number(summaryBefore.total_active_discount)).toBe(25)
    expect(Number(summaryBefore.total_rolled_back_discount)).toBe(0)
    expect(Number(summaryBefore.lifetime_discount)).toBe(25)

    const staff = await Staff.findOne({ email: 'coupon-mgr@example.com' })
    await cancelOrder(order.id, staff.id, 'test rollback')

    const after = await request(app)
      .get(`/api/v1/admin/coupons/${coupon.id}/usage`)
      .set('Cookie', staffCookie)
    expect(after.body.data[0].status).toBe('rolled_back')
    expect(after.body.data[0].rolled_back_at).toBeTruthy()
    expect(after.body.data[0].rollback_reason).toBe('test rollback')
    expect(after.body.data[0].rolled_back_by).toMatchObject({
      id: String(staff.id),
    })

    const summaryAfterRes = await request(app)
      .get('/api/v1/admin/coupons/usage-summary')
      .set('Cookie', staffCookie)
    const summaryAfter = summaryAfterRes.body.data.find((r) => String(r.coupon_id) === String(coupon.id))
    expect(summaryAfter.active_usage_count).toBe(0)
    expect(summaryAfter.rolled_back_count).toBe(1)
    expect(summaryAfter.unique_customer_count).toBe(0)
    expect(Number(summaryAfter.total_active_discount)).toBe(0)
    expect(Number(summaryAfter.total_rolled_back_discount)).toBe(25)
    expect(summaryAfter.lifetime_usage_count).toBe(1)
    expect(Number(summaryAfter.lifetime_discount)).toBe(25)

    await cancelOrder(order.id, staff.id, 'retry rollback')
    const summaryAgain = (await request(app)
      .get('/api/v1/admin/coupons/usage-summary')
      .set('Cookie', staffCookie)).body.data.find((r) => String(r.coupon_id) === String(coupon.id))
    expect(summaryAgain.rolled_back_count).toBe(1)
    expect(Number(summaryAgain.total_rolled_back_discount)).toBe(25)
    expect((await Coupon.findById(coupon.id)).usedCount).toBe(0)
  })

  it('paginates coupon list and usage; page 2 is discoverable', async () => {
    for (let i = 0; i < 3; i += 1) {
      await createActiveCoupon({
        code: `PAGEC${i}`,
        discount_type: 'flat',
        discount_value: 1,
      })
    }
    const page1 = await request(app)
      .get('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .query({ page: 1, limit: 2, search: 'PAGEC' })
    expect(page1.status).toBe(200)
    expect(page1.body.data.length).toBe(2)
    expect(page1.body.meta.total).toBeGreaterThanOrEqual(3)
    expect(page1.body.meta.pages).toBeGreaterThanOrEqual(2)

    const page2 = await request(app)
      .get('/api/v1/admin/coupons')
      .set('Cookie', staffCookie)
      .query({ page: 2, limit: 2, search: 'PAGEC' })
    expect(page2.body.data.length).toBeGreaterThanOrEqual(1)
    const ids1 = new Set(page1.body.data.map((c) => c.id))
    expect(page2.body.data.some((c) => !ids1.has(c.id))).toBe(true)

    const coupon = await createActiveCoupon({
      code: 'USAGEPAGE',
      discount_type: 'flat',
      discount_value: 1,
      usage_limit: 50,
      per_customer_limit: 50,
    })

    const { CouponRedemption } = await import('../src/models/commerce.models.js')
    const redemptionIds = []
    for (let i = 0; i < 3; i += 1) {
      const o = await Order.create({
        customerId: customer.id,
        orderNumber: `ORD-P-${i}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentMethod: 'cod',
        paymentMode: 'cash',
        invoiceNumber: `INV-P-${i}-${Date.now()}`,
        subtotal: 10,
        discountAmount: 1,
        taxAmount: 0,
        shippingFee: 0,
        total: 9,
        shipTo: { line1: 'x', city: 'Dubai', country: 'UAE' },
        idempotencyKey: `usage-page-${i}-${Date.now()}`,
        couponCode: coupon.code,
      })
      const [red] = await CouponRedemption.create([{
        couponId: coupon.id,
        customerId: customer.id,
        orderId: o.id,
        discountAmount: 1,
        status: 'active',
      }])
      redemptionIds.push(String(red.id))
    }

    const u1 = await request(app)
      .get(`/api/v1/admin/coupons/${coupon.id}/usage`)
      .set('Cookie', staffCookie)
      .query({ page: 1, limit: 2 })
    expect(u1.body.data.length).toBe(2)
    expect(u1.body.meta.total).toBe(3)
    expect(u1.body.meta.pages).toBe(2)
    const u2 = await request(app)
      .get(`/api/v1/admin/coupons/${coupon.id}/usage`)
      .set('Cookie', staffCookie)
      .query({ page: 2, limit: 2 })
    expect(u2.body.data.length).toBe(1)
    const uIds1 = new Set(u1.body.data.map((r) => r.redemption_id))
    expect(uIds1.has(u2.body.data[0].redemption_id)).toBe(false)
    expect(redemptionIds).toContain(u2.body.data[0].redemption_id)
  })
})

function roundMoneySum(values) {
  return Math.round(values.reduce((s, n) => s + Number(n || 0), 0) * 100) / 100
}
