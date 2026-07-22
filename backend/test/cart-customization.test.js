import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import app from '../src/app.js'
import { Customer } from '../src/models/auth.models.js'
import { Brand, Category, Product, ProductImage, StoreSetting, TaxSetting, Variant } from '../src/models/catalog.models.js'
import { Address, CartItem } from '../src/models/commerce.models.js'
import { GoldRate } from '../src/models/rate.models.js'
import { issueSession } from '../src/services/auth.service.js'
import * as customerService from '../src/services/customer.service.js'
import * as orderService from '../src/services/order.service.js'
import { toCustomerOrderDto } from '../src/utils/customerOrderDto.js'
import { customizationKey } from '../src/utils/customization.js'
import { SESSION_COOKIES } from '../src/utils/sessionCookies.js'

let mongoServer
let customer
let otherCustomer
let customerCookie
let otherCookie
let address
let variant

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
}

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-cart-customization'))
  await CartItem.syncIndexes()
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

  customer = await Customer.create({ phone: '+971501333001', fullName: 'Cart User', authProvider: 'otp' })
  otherCustomer = await Customer.create({ phone: '+971501333002', fullName: 'Other User', authProvider: 'otp' })
  const tokens = await issueSession(customer, 'customer')
  const otherTokens = await issueSession(otherCustomer, 'customer')
  customerCookie = cookieHeader({
    [SESSION_COOKIES.customerAccess]: tokens.accessToken,
    [SESSION_COOKIES.customerRefresh]: tokens.refreshToken,
  })
  otherCookie = cookieHeader({
    [SESSION_COOKIES.customerAccess]: otherTokens.accessToken,
    [SESSION_COOKIES.customerRefresh]: otherTokens.refreshToken,
  })

  address = await Address.create({
    customerId: customer.id,
    recipientName: 'Cart User',
    phone: '+971501333001',
    line1: 'Marina',
    city: 'Dubai',
    state: 'Dubai',
    country: 'UAE',
  })
  const brand = await Brand.create({ name: 'C', slug: 'c-cart', isActive: true })
  const category = await Category.create({ name: 'R', slug: 'r-cart', isActive: true })
  const product = await Product.create({
    name: 'Custom Ring',
    slug: 'custom-ring',
    brandId: brand.id,
    categoryId: category.id,
    status: 'active',
    metalType: 'gold',
    purity: '22k',
    isCustomizable: true,
  })
  variant = await Variant.create({
    productId: product.id,
    sku: 'CART-CUST-1',
    label: '16',
    weightGrams: 4,
    effectiveWeight: 4,
    stockQty: 50,
    purity: '22k',
    isActive: true,
  })
  await ProductImage.create({ productId: product.id, imageUrl: 'https://cdn.example.com/c.jpg', isPrimary: true })
})

describe('cart customization_request', () => {
  it('POST cart without customization succeeds', async () => {
    const res = await request(app)
      .post('/api/v1/customer/cart')
      .set('Cookie', customerCookie)
      .send({ variant_id: variant.id, qty: 1 })
      .expect(201)
    expect(res.body.data.customization_request).toBeNull()
    expect(res.body.data.qty).toBe(1)
  })

  it('POST with valid customization_request succeeds and returns field', async () => {
    const res = await request(app)
      .post('/api/v1/customer/cart')
      .set('Cookie', customerCookie)
      .send({ variant_id: variant.id, qty: 1, customization_request: 'Engrave Aisha' })
      .expect(201)
    expect(res.body.data.customization_request).toBe('Engrave Aisha')
    expect(res.body.data.customization_key).toBe(customizationKey('Engrave Aisha'))
  })

  it('trims customization and converts empty string to null', async () => {
    const trimmed = await request(app)
      .post('/api/v1/customer/cart')
      .set('Cookie', customerCookie)
      .send({ variant_id: variant.id, qty: 1, customization_request: '  Hello  ' })
      .expect(201)
    expect(trimmed.body.data.customization_request).toBe('Hello')

    await CartItem.deleteMany({})
    const empty = await request(app)
      .post('/api/v1/customer/cart')
      .set('Cookie', customerCookie)
      .send({ variant_id: variant.id, qty: 1, customization_request: '   ' })
      .expect(201)
    expect(empty.body.data.customization_request).toBeNull()
  })

  it('accepts null customization_request', async () => {
    const res = await request(app)
      .post('/api/v1/customer/cart')
      .set('Cookie', customerCookie)
      .send({ variant_id: variant.id, qty: 1, customization_request: null })
      .expect(201)
    expect(res.body.data.customization_request).toBeNull()
  })

  it('rejects more than 1000 characters', async () => {
    const res = await request(app)
      .post('/api/v1/customer/cart')
      .set('Cookie', customerCookie)
      .send({ variant_id: variant.id, qty: 1, customization_request: 'x'.repeat(1001) })
      .expect(422)
    expect(res.body.error?.code || res.body.code).toMatch(/VALIDATION|CUSTOMIZATION/)
  })

  it('rejects object/array customization and unknown fields', async () => {
    const obj = await request(app)
      .post('/api/v1/customer/cart')
      .set('Cookie', customerCookie)
      .send({ variant_id: variant.id, qty: 1, customization_request: { note: 'nope' } })
      .expect(422)
    expect(obj.body.error?.code || obj.body.code).toBe('VALIDATION_ERROR')

    const unknown = await request(app)
      .post('/api/v1/customer/cart')
      .set('Cookie', customerCookie)
      .send({ variant_id: variant.id, qty: 1, evil_field: true })
      .expect(422)
    expect(JSON.stringify(unknown.body)).toMatch(/Unrecognized key|evil_field/i)
  })

  it('PATCH customization only succeeds and can clear with null', async () => {
    const created = await request(app)
      .post('/api/v1/customer/cart')
      .set('Cookie', customerCookie)
      .send({ variant_id: variant.id, qty: 2, customization_request: 'Keep me' })
      .expect(201)

    const patched = await request(app)
      .patch(`/api/v1/customer/cart/${created.body.data.id}`)
      .set('Cookie', customerCookie)
      .send({ customization_request: 'Updated text' })
      .expect(200)
    expect(patched.body.data.qty).toBe(2)
    expect(patched.body.data.customization_request).toBe('Updated text')

    const cleared = await request(app)
      .patch(`/api/v1/customer/cart/${created.body.data.id}`)
      .set('Cookie', customerCookie)
      .send({ customization_request: null })
      .expect(200)
    expect(cleared.body.data.customization_request).toBeNull()
  })

  it('existing line increments qty and keeps customization when same text is re-added', async () => {
    await customerService.addCartItem(customer.id, {
      variant_id: variant.id,
      qty: 1,
      customization_request: 'First',
    })
    const again = await customerService.addCartItem(customer.id, {
      variant_id: variant.id,
      qty: 1,
      customization_request: 'First',
    })
    expect(again.qty).toBe(2)
    expect(again.customizationRequest).toBe('First')
    expect(await CartItem.countDocuments({ customerId: customer.id })).toBe(1)
  })

  it('PATCH can replace customization text on an existing line', async () => {
    const created = await customerService.addCartItem(customer.id, {
      variant_id: variant.id,
      qty: 1,
      customization_request: 'Old text',
    })
    const updated = await customerService.updateCartItem(customer.id, created.id, {
      customization_request: 'New text',
    })
    expect(updated.qty).toBe(1)
    expect(updated.customizationRequest).toBe('New text')
    expect(updated.customizationKey).toBe(customizationKey('New text'))
    expect(await CartItem.countDocuments({ customerId: customer.id })).toBe(1)
  })

  it('different customization text creates separate cart lines', async () => {
    await customerService.addCartItem(customer.id, {
      variant_id: variant.id,
      qty: 1,
      customization_request: 'Aisha',
    })
    await customerService.addCartItem(customer.id, {
      variant_id: variant.id,
      qty: 1,
      customization_request: 'Omar',
    })
    const rows = await CartItem.find({ customerId: customer.id }).sort({ addedAt: -1 })
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.customizationRequest).sort()).toEqual(['Aisha', 'Omar'])
  })

  it('order placement snapshots customization; customer and admin DTOs expose it', async () => {
    await customerService.addCartItem(customer.id, {
      variant_id: variant.id,
      qty: 1,
      customization_request: 'Forever',
    })
    const order = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'manual',
      wallet_use: 0,
      idempotency_key: 'cart-cust-order-1',
    })
    expect(order.items[0].customizationRequest).toBe('Forever')

    const customerDto = toCustomerOrderDto(order)
    expect(customerDto.items[0].customization_request).toBe('Forever')

    const admin = await orderService.getAdminOrder(order.id)
    const { serialize } = await import('../src/utils/serialize.js')
    expect(serialize(admin).items[0].customization_request).toBe('Forever')
  })

  it('another customer cannot modify the cart item', async () => {
    const created = await request(app)
      .post('/api/v1/customer/cart')
      .set('Cookie', customerCookie)
      .send({ variant_id: variant.id, qty: 1, customization_request: 'Mine' })
      .expect(201)

    await request(app)
      .patch(`/api/v1/customer/cart/${created.body.data.id}`)
      .set('Cookie', otherCookie)
      .send({ customization_request: 'Hacked' })
      .expect(404)
  })

  it('rejects empty PATCH body', async () => {
    const created = await request(app)
      .post('/api/v1/customer/cart')
      .set('Cookie', customerCookie)
      .send({ variant_id: variant.id, qty: 1 })
      .expect(201)

    await request(app)
      .patch(`/api/v1/customer/cart/${created.body.data.id}`)
      .set('Cookie', customerCookie)
      .send({})
      .expect(422)
  })

  it('GET cart returns customization_request', async () => {
    await request(app)
      .post('/api/v1/customer/cart')
      .set('Cookie', customerCookie)
      .send({ variant_id: variant.id, qty: 1, customization_request: 'List me' })
      .expect(201)

    const list = await request(app)
      .get('/api/v1/customer/cart')
      .set('Cookie', customerCookie)
      .expect(200)
    expect(list.body.data[0].customization_request).toBe('List me')
  })
})
