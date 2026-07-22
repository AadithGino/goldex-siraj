import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import app from '../src/app.js'
import { Customer, Staff } from '../src/models/auth.models.js'
import { Brand, Category, Product, ProductImage, StoreSetting, TaxSetting, Variant } from '../src/models/catalog.models.js'
import { GoldRate } from '../src/models/rate.models.js'
import { hashPassword, issueSession } from '../src/services/auth.service.js'
import { SESSION_COOKIES } from '../src/utils/sessionCookies.js'

let mongoServer
let staffCookie
let customerCookie
let variant

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
}

function assertNotValidationError(res) {
  expect(res.status).not.toBe(422)
  expect(res.body?.error?.code).not.toBe('VALIDATION_ERROR')
}

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-api-contract'))
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
    shippingFee: 25,
    freeShippingThreshold: 5000,
  })
  await TaxSetting.create({ singleton: 'default', isActive: true, taxPercent: 5, taxMode: 'exclusive', applyOn: 'total' })
  await GoldRate.create({ purity: '22k', ratePerGram: 250, isCurrent: true, effectiveAt: new Date() })

  const staff = await Staff.create({
    fullName: 'Contract Manager',
    email: 'contract-manager@example.com',
    passwordHash: await hashPassword('password-12345678'),
    role: 'manager',
    isActive: true,
  })
  const staffTokens = await issueSession(staff, 'staff')
  staffCookie = cookieHeader({
    [SESSION_COOKIES.staffAccess]: staffTokens.accessToken,
    [SESSION_COOKIES.staffRefresh]: staffTokens.refreshToken,
  })

  const customer = await Customer.create({
    phone: '+971501444001',
    fullName: 'Contract Customer',
    authProvider: 'otp',
    isActive: true,
  })
  const customerTokens = await issueSession(customer, 'customer')
  customerCookie = cookieHeader({
    [SESSION_COOKIES.customerAccess]: customerTokens.accessToken,
    [SESSION_COOKIES.customerRefresh]: customerTokens.refreshToken,
  })

  const brand = await Brand.create({ name: 'Contract Brand', slug: 'contract-brand', isActive: true })
  const category = await Category.create({ name: 'Contract Cat', slug: 'contract-cat', isActive: true })
  const product = await Product.create({
    name: 'Contract Ring',
    slug: 'contract-ring',
    brandId: brand.id,
    categoryId: category.id,
    status: 'active',
    metalType: 'gold',
    purity: '22k',
  })
  variant = await Variant.create({
    productId: product.id,
    sku: 'CONTRACT-1',
    label: '16',
    weightGrams: 4,
    effectiveWeight: 4,
    stockQty: 10,
    purity: '22k',
    isActive: true,
  })
  await ProductImage.create({ productId: product.id, imageUrl: 'https://cdn.example.com/c.jpg', isPrimary: true })
})

describe('Phase 21 admin GET API contracts (no body)', () => {
  const adminGets = [
    { path: '/api/v1/admin/catalog/products', paginated: true },
    { path: '/api/v1/admin/catalog/categories' },
    { path: '/api/v1/admin/catalog/brands' },
    { path: '/api/v1/admin/catalog/variants' },
    { path: '/api/v1/admin/catalog/images' },
    { path: '/api/v1/admin/catalog/certificates' },
    { path: '/api/v1/admin/catalog/banners' },
    { path: '/api/v1/admin/catalog/cms-pages' },
    { path: '/api/v1/admin/inventory/variants', paginated: true },
    { path: '/api/v1/admin/inventory/low-stock' },
    { path: '/api/v1/admin/stock-ledger', paginated: true },
    { path: '/api/v1/admin/rates/gold' },
    { path: '/api/v1/admin/rates/stone' },
    { path: '/api/v1/admin/orders', paginated: true },
    { path: '/api/v1/admin/customers', paginated: true },
    { path: '/api/v1/admin/coupons' },
    { path: '/api/v1/admin/coupons/usage-summary' },
    { path: '/api/v1/admin/schemes' },
    { path: '/api/v1/admin/schemes/enrollments/all' },
    { path: '/api/v1/admin/returns' },
    { path: '/api/v1/admin/reviews' },
    { path: '/api/v1/admin/reports/dashboard' },
    { path: '/api/v1/admin/reports/sales' },
    { path: '/api/v1/admin/audit-log', paginated: true },
    { path: '/api/v1/admin/staff' },
    { path: '/api/v1/admin/payment-events', paginated: true },
  ]

  for (const endpoint of adminGets) {
    it(`GET ${endpoint.path} without body does not return VALIDATION_ERROR`, async () => {
      const res = await request(app)
        .get(endpoint.path)
        .set('Cookie', staffCookie)
      assertNotValidationError(res)
      expect(res.status).toBeLessThan(500)
      expect(res.body.success).toBe(true)
      expect(res.body.data !== undefined).toBe(true)
      if (endpoint.paginated) {
        expect(res.body.meta).toBeTruthy()
        expect(res.body.meta.page).toBeTypeOf('number')
        expect(res.body.meta.limit).toBeTypeOf('number')
      }
    })
  }

  it('admin catalog products accepts legitimate list filters', async () => {
    const res = await request(app)
      .get('/api/v1/admin/catalog/products')
      .query({ page: 1, limit: 20, search: 'Ring', status: 'active' })
      .set('Cookie', staffCookie)
    assertNotValidationError(res)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('rejects malformed order id without 500', async () => {
    const res = await request(app)
      .get('/api/v1/admin/orders/not-an-object-id')
      .set('Cookie', staffCookie)
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
    expect(res.body?.error?.code).not.toBeUndefined()
  })
})

describe('Phase 21 customer API contracts', () => {
  it('GET cart without body succeeds', async () => {
    const res = await request(app)
      .get('/api/v1/customer/cart')
      .set('Cookie', customerCookie)
    assertNotValidationError(res)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('GET catalog products and bootstrap succeed without body', async () => {
    const products = await request(app).get('/api/v1/customer/catalog/products').query({ page: 1, limit: 12 })
    assertNotValidationError(products)
    expect(products.body.success).toBe(true)
    expect(products.body.meta).toBeTruthy()

    const bootstrap = await request(app).get('/api/v1/customer/catalog/bootstrap')
    assertNotValidationError(bootstrap)
    expect(bootstrap.body.success).toBe(true)
    expect(bootstrap.body.data).toBeTruthy()
  })

  it('POST cart accepts customization_request', async () => {
    const res = await request(app)
      .post('/api/v1/customer/cart')
      .set('Cookie', customerCookie)
      .send({ variant_id: variant.id, qty: 1, customization_request: 'Engrave Phase21' })
    expect(res.status).toBe(201)
    expect(res.body.data.customization_request).toBe('Engrave Phase21')
  })
})
