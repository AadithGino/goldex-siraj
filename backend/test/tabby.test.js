import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { config } from '../src/config/env.js'
import { Customer } from '../src/models/auth.models.js'
import { Brand, Category, Product, StoreSetting, TaxSetting, Variant } from '../src/models/catalog.models.js'
import { Address, CartItem, Order, WalletTransaction } from '../src/models/commerce.models.js'
import { GoldRate } from '../src/models/rate.models.js'
import * as orderService from '../src/services/order.service.js'
import { abandonTabbyOrder, finalizeTabbyPayment } from '../src/services/tabby.payment.service.js'
import { loadTabbyCustomerContext, verifyTabbyWebhookAuth } from '../src/services/tabby.service.js'

let mongoServer
let customer
let address
let variant
let tabby

const originalTabby = { ...config.tabby }
const originalFetch = globalThis.fetch

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function installTabbyMock() {
  tabby = {
    sessions: [],
    captures: [],
    refunds: [],
    closes: [],
    rejectSession: false,
    payment: null,
  }
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const path = new URL(url).pathname
    const body = init.body ? JSON.parse(init.body) : null
    if (path === '/api/v2/checkout' && init.method === 'POST') {
      tabby.sessions.push(body)
      if (tabby.rejectSession) {
        return jsonResponse({
          status: 'rejected',
          configuration: { available_products: {}, products: { installments: { rejection_reason: 'order_amount_too_high' } } },
        })
      }
      if (body.merchant_urls) {
        tabby.payment = {
          id: 'pay-1',
          status: 'CREATED',
          amount: body.payment.amount,
          currency: 'AED',
          order: { reference_id: body.payment.order.reference_id },
          captures: [],
          refunds: [],
        }
      }
      return jsonResponse({
        id: 'session-1',
        status: 'created',
        payment: { id: 'pay-1' },
        configuration: { available_products: { installments: [{ web_url: 'https://checkout.tabby.ai/?sessionId=session-1' }] } },
      })
    }
    const captureMatch = path.match(/^\/api\/v2\/payments\/([^/]+)\/captures$/)
    if (captureMatch) {
      tabby.captures.push(body)
      if (!tabby.payment.captures.some((row) => row.reference_id === body.reference_id)) {
        tabby.payment.captures.push({ id: `cap-${tabby.captures.length}`, amount: body.amount, reference_id: body.reference_id, created_at: new Date().toISOString() })
      }
      tabby.payment.status = 'CLOSED'
      return jsonResponse(tabby.payment)
    }
    const refundMatch = path.match(/^\/api\/v2\/payments\/([^/]+)\/refunds$/)
    if (refundMatch) {
      tabby.refunds.push(body)
      tabby.payment.refunds.push({ id: `ref-${tabby.refunds.length}`, amount: body.amount, reference_id: body.reference_id, created_at: new Date().toISOString() })
      return jsonResponse(tabby.payment)
    }
    const closeMatch = path.match(/^\/api\/v2\/payments\/([^/]+)\/close$/)
    if (closeMatch) {
      tabby.closes.push(closeMatch[1])
      tabby.payment.status = 'CLOSED'
      return jsonResponse(tabby.payment)
    }
    const paymentMatch = path.match(/^\/api\/v2\/payments\/([^/]+)$/)
    if (paymentMatch) return jsonResponse(tabby.payment)
    return jsonResponse({ error: 'not found' }, 404)
  })
}

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-tabby-test'))
  Object.assign(config.tabby, {
    enabled: true,
    baseUrl: 'https://api.tabby.ai',
    secretKey: 'sk_test_x',
    publicKey: 'pk_test_x',
    merchantCode: 'goldex_ae',
    webhookSecret: 'hook-secret',
    webhookHeaderName: 'X-Goldex-Tabby-Auth',
  })
}, 120_000)

afterAll(async () => {
  Object.assign(config.tabby, originalTabby)
  globalThis.fetch = originalFetch
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})))
  installTabbyMock()

  await StoreSetting.create({ singleton: 'default', codEnabled: true, bankTransferEnabled: true, onlinePaymentEnabled: true, shippingFee: 0, freeShippingThreshold: 0 })
  await TaxSetting.create({ singleton: 'default', isActive: true, taxPercent: 5, taxMode: 'exclusive', applyOn: 'total' })
  await GoldRate.create({ purity: '22k', ratePerGram: 250, isCurrent: true, effectiveAt: new Date() })

  customer = await Customer.create({ phone: '+971500000001', email: 'otp.success@tabby.ai', fullName: 'Tabby Buyer', authProvider: 'otp' })
  address = await Address.create({
    customerId: customer.id,
    recipientName: 'Tabby Buyer',
    phone: '+971500000001',
    line1: 'Marina Walk',
    city: 'Dubai',
    state: 'Dubai',
    country: 'United Arab Emirates',
  })
  const brand = await Brand.create({ name: 'Goldex', slug: 'goldex', isActive: true })
  const category = await Category.create({ name: 'Rings', slug: 'rings', isActive: true })
  const product = await Product.create({
    name: 'Classic Ring', slug: 'classic-ring', brandId: brand.id, categoryId: category.id,
    status: 'active', metalType: 'gold', metalColor: 'yellow', purity: '22k',
  })
  variant = await Variant.create({
    productId: product.id, sku: 'RING-22K-01', label: 'Size 16', weightGrams: 4, effectiveWeight: 3.8,
    stockQty: 1, purity: '22k', isActive: true,
  })
  await CartItem.create({ customerId: customer.id, variantId: variant.id, qty: 1 })
})

async function placeTabbyOrder(key = 'tabby-1') {
  return orderService.placeOrder(customer.id, {
    address_id: address.id,
    payment_method: 'online',
    payment_provider: 'tabby',
    lang: 'ar',
    wallet_use: 0,
    idempotency_key: key,
  })
}

describe('Tabby buyer_history', () => {
  it('sets loyalty_level to paid order count (not only delivered)', async () => {
    const shipTo = {
      recipientName: address.recipientName,
      phone: address.phone,
      line1: address.line1,
      city: address.city,
      state: address.state,
      country: address.country,
    }
    for (let i = 0; i < 3; i += 1) {
      await Order.create({
        customerId: customer.id,
        orderNumber: `ORD-TEST-${i}`,
        idempotencyKey: `loyalty-${i}`,
        status: 'processing',
        paymentStatus: 'paid',
        paymentMethod: 'online',
        shipTo,
        items: [],
        subtotal: 100,
        makingChargeTotal: 0,
        discountAmount: 0,
        taxAmount: 0,
        shippingFee: 0,
        walletApplied: 0,
        total: 100,
        amountDue: 100,
        finalTotal: 100,
        placedAt: new Date(),
      })
    }
    await Order.create({
      customerId: customer.id,
      orderNumber: 'ORD-TEST-DEL',
      idempotencyKey: 'loyalty-delivered',
      status: 'delivered',
      paymentStatus: 'paid',
      paymentMethod: 'online',
      shipTo,
      items: [],
      subtotal: 50,
      makingChargeTotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      shippingFee: 0,
      walletApplied: 0,
      total: 50,
      amountDue: 50,
      finalTotal: 50,
      placedAt: new Date(),
    })
    await Order.create({
      customerId: customer.id,
      orderNumber: 'ORD-TEST-PEND',
      idempotencyKey: 'loyalty-pending',
      status: 'placed',
      paymentStatus: 'pending',
      paymentMethod: 'online',
      shipTo,
      items: [],
      subtotal: 10,
      makingChargeTotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      shippingFee: 0,
      walletApplied: 0,
      total: 10,
      amountDue: 10,
      finalTotal: 10,
      placedAt: new Date(),
    })

    const { buyerHistory, orderHistory } = await loadTabbyCustomerContext(customer)
    expect(buyerHistory.loyalty_level).toBe(4)
    expect(orderHistory.length).toBeGreaterThanOrEqual(4)
  })
})

describe('Tabby checkout session', () => {
  it('sends a full, localized payload without placeholders and keeps the bag', async () => {
    const order = await placeTabbyOrder()
    expect(order.checkoutUrl).toContain('checkout.tabby.ai')
    expect(await CartItem.countDocuments({ customerId: customer.id })).toBe(1)

    const session = tabby.sessions.at(-1)
    expect(session.lang).toBe('ar')
    expect(session.merchant_code).toBe('goldex_ae')
    expect(session.payment.buyer).toEqual({ name: 'Tabby Buyer', email: 'otp.success@tabby.ai', phone: '+971500000001' })
    expect(session.payment.buyer_history.registered_since).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(session.payment.order.items[0]).toMatchObject({ reference_id: 'RING-22K-01', category: 'Rings', quantity: 1 })
    expect(session.merchant_urls.cancel).toContain(`/checkout?tabby=cancelled&order=${order.id}`)
    expect(session.merchant_urls.failure).toContain(`/checkout?tabby=failed&order=${order.id}`)
    expect(session.payment.amount).toBe(Number(order.amountDue).toFixed(2))
  })

  it('omits buyer.email when the customer profile has no email', async () => {
    await Customer.updateOne({ _id: customer.id }, { $unset: { email: 1 } })
    const order = await placeTabbyOrder('tabby-no-email')
    const session = tabby.sessions.at(-1)
    expect(session.payment.buyer.email).toBeUndefined()
    expect(session.payment.buyer).toMatchObject({ name: 'Tabby Buyer', phone: '+971500000001' })
    expect(order.checkoutUrl).toContain('checkout.tabby.ai')
  })

  it('surfaces a rejected session as TABBY_REJECTED and rolls the order back', async () => {
    tabby.rejectSession = true
    await expect(placeTabbyOrder()).rejects.toMatchObject({
      code: 'TABBY_REJECTED',
      details: { rejection_reason: 'order_amount_too_high' },
    })
    expect(await Order.countDocuments()).toBe(0)
    expect(await CartItem.countDocuments({ customerId: customer.id })).toBe(1)
  })
})

describe('Tabby payment processing', () => {
  it('verifies, marks paid, captures the full amount once and clears the bag', async () => {
    const order = await placeTabbyOrder()
    tabby.payment.status = 'AUTHORIZED'

    const first = await finalizeTabbyPayment(order.id, { source: 'redirect' })
    expect(first.outcome).toBe('paid')
    await finalizeTabbyPayment(order.id, { source: 'webhook' })

    expect(tabby.captures).toHaveLength(1)
    expect(tabby.captures[0]).toEqual({ amount: Number(order.amountDue).toFixed(2), reference_id: `capture-${order.id}` })
    const fresh = await Order.findById(order.id)
    expect(fresh.paymentStatus).toBe('paid')
    expect(fresh.tabbyCaptureStatus).toBe('captured')
    expect(await CartItem.countDocuments({ customerId: customer.id })).toBe(0)
  })

  it('cancels the attempt and releases stock when the customer aborts, keeping the bag', async () => {
    const order = await placeTabbyOrder()
    tabby.payment.status = 'EXPIRED'

    const result = await abandonTabbyOrder(customer.id, order.id)
    expect(result.outcome).toBe('cancelled')
    expect((await Order.findById(order.id)).status).toBe('cancelled')
    expect((await Variant.findById(variant.id)).stockQty).toBe(1)
    expect(await CartItem.countDocuments({ customerId: customer.id })).toBe(1)
  })

  it('refunds cancellations of captured orders through Tabby, not the wallet', async () => {
    const order = await placeTabbyOrder()
    tabby.payment.status = 'AUTHORIZED'
    await finalizeTabbyPayment(order.id, { source: 'redirect' })

    await orderService.cancelOrder(order.id, null, 'Customer changed mind')
    expect(tabby.refunds).toHaveLength(1)
    expect(tabby.refunds[0]).toMatchObject({ amount: Number(order.amountDue).toFixed(2), reference_id: `refund-cancel-${order.id}` })
    expect(await WalletTransaction.countDocuments({ customerId: customer.id, type: 'refund' })).toBe(0)
    const fresh = await Order.findById(order.id)
    expect(fresh.paymentStatus).toBe('refunded')
    expect(fresh.tabbyRefundedTotal).toBeCloseTo(Number(order.amountDue), 2)
  })
})

describe('Tabby webhook auth', () => {
  it('accepts only the registered static header', () => {
    expect(verifyTabbyWebhookAuth({ 'x-goldex-tabby-auth': 'hook-secret' })).toBe(true)
    expect(verifyTabbyWebhookAuth({ 'x-goldex-tabby-auth': 'wrong' })).toBe(false)
    expect(verifyTabbyWebhookAuth({})).toBe(false)
  })
})
