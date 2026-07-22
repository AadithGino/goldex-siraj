import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Customer, Staff } from '../src/models/auth.models.js'
import { Brand, Category, Product, ProductImage, StoreSetting, TaxSetting, Variant } from '../src/models/catalog.models.js'
import { Address, CartItem, PaymentEvent, ReturnRequest } from '../src/models/commerce.models.js'
import { GoldRate } from '../src/models/rate.models.js'
import { hashPassword } from '../src/services/auth.service.js'
import * as orderService from '../src/services/order.service.js'
import * as returnService from '../src/services/return.service.js'
import * as walletService from '../src/services/wallet.service.js'

let mongoServer
let customer
let staff
let address
let variant

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-returns-test'))
  await ReturnRequest.syncIndexes()
  const { ReturnCoordination } = await import('../src/models/commerce.models.js')
  await ReturnCoordination.syncIndexes()
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})))
  await StoreSetting.create({
    singleton: 'default',
    codEnabled: true,
    bankTransferEnabled: true,
    shippingFee: 0,
    freeShippingThreshold: 0,
    returnWindowDays: 30,
  })
  await TaxSetting.create({ singleton: 'default', isActive: true, taxPercent: 5, taxMode: 'exclusive', applyOn: 'total' })
  await GoldRate.create({ purity: '22k', ratePerGram: 250, isCurrent: true, effectiveAt: new Date() })
  customer = await Customer.create({ phone: '+971501000444', fullName: 'Return User', authProvider: 'otp' })
  staff = await Staff.create({
    fullName: 'Manager',
    email: 'returns@example.com',
    passwordHash: await hashPassword('password-12345678'),
    role: 'manager',
  })
  address = await Address.create({
    customerId: customer.id,
    recipientName: 'Return User',
    phone: '+971501000444',
    line1: 'Marina',
    city: 'Dubai',
    state: 'Dubai',
    country: 'UAE',
  })
  const brand = await Brand.create({ name: 'G', slug: 'g-ret', isActive: true })
  const category = await Category.create({ name: 'R', slug: 'r-ret', isActive: true })
  const product = await Product.create({
    name: 'Return Ring',
    slug: 'return-ring',
    brandId: brand.id,
    categoryId: category.id,
    status: 'active',
    metalType: 'gold',
    purity: '22k',
  })
  variant = await Variant.create({
    productId: product.id,
    sku: 'RET-1',
    label: '16',
    weightGrams: 4,
    effectiveWeight: 4,
    stockQty: 20,
    purity: '22k',
    isActive: true,
  })
  await ProductImage.create({ productId: product.id, imageUrl: 'https://cdn.example.com/r.jpg', isPrimary: true, displayOrder: 0 })
})

async function placeManual(key) {
  await CartItem.create({ customerId: customer.id, variantId: variant.id, qty: 1 })
  return orderService.placeOrder(customer.id, {
    address_id: address.id,
    payment_method: 'manual',
    wallet_use: 0,
    idempotency_key: key,
  })
}

describe('cancellation and returns refunds', () => {
  it('credits paid manual cancellation to wallet with a refund payment event', async () => {
    const order = await placeManual('ret-cancel-1')
    await orderService.markManualPaid(order.id, staff.id, {
      payment_mode: 'bank_transfer',
      transaction_ref: 'BT-1',
      amount_collected: Number(order.total),
    })
    const paid = await orderService.getAdminOrder(order.id)
    const paidTotal = Number(paid.finalTotal)
    expect(paidTotal).toBeGreaterThan(0)

    await orderService.updateStatus(order.id, 'confirmed', 'ok', staff.id)
    const cancelled = await orderService.cancelOrder(order.id, staff.id, 'customer cancel')
    expect(cancelled.paymentStatus).toBe('refunded')
    expect(cancelled.refundedTotal).toBeCloseTo(paidTotal, 2)

    const events = await PaymentEvent.find({ orderId: order.id, eventType: 'order_cancel_refund' })
    expect(events).toHaveLength(1)
    expect(events[0].amount).toBeCloseTo(paidTotal, 2)
    expect(events[0].verified).toBe(true)
    expect(await walletService.balance(customer.id)).toBeCloseTo(paidTotal, 2)

    // Retry must not double-credit
    await orderService.cancelOrder(order.id, staff.id, 'retry')
    expect(await walletService.balance(customer.id)).toBeCloseTo(paidTotal, 2)
    expect(await PaymentEvent.countDocuments({ orderId: order.id, eventType: 'order_cancel_refund' })).toBe(1)
  })

  it('rejects return requests for items that are not on the order', async () => {
    const order = await placeManual('ret-bad-item')
    await orderService.markManualPaid(order.id, staff.id, { payment_mode: 'card', transaction_ref: 'CARD-1', amount_collected: Number(order.total) })
    await mongoose.model('Order').findByIdAndUpdate(order.id, { status: 'delivered', deliveredAt: new Date() })

    await expect(returnService.requestReturn(customer.id, {
      order_id: order.id,
      kind: 'return',
      order_item_id: new mongoose.Types.ObjectId().toString(),
      reason: 'wrong',
    })).rejects.toMatchObject({ code: 'INVALID_ORDER_ITEM' })
  })

  it('completes a full return once and credits remaining paid value', async () => {
    const order = await placeManual('ret-full-1')
    await orderService.markManualPaid(order.id, staff.id, { payment_mode: 'bank_transfer', transaction_ref: 'BT-2', amount_collected: Number(order.total) })
    await mongoose.model('Order').findByIdAndUpdate(order.id, { status: 'delivered', deliveredAt: new Date() })

    const req = await returnService.requestReturn(customer.id, {
      order_id: order.id,
      kind: 'return',
      reason: 'changed mind',
    })
    await returnService.resolveReturn(req.id, { status: 'approved', resolution_note: 'ok' }, staff.id)
    const completed = await returnService.resolveReturn(req.id, { status: 'completed', resolution_note: 'done' }, staff.id)
    expect(completed.status).toBe('completed')

    const after = await mongoose.model('Order').findById(order.id)
    expect(after.status).toBe('returned')
    expect(after.paymentStatus).toBe('refunded')
    expect(await walletService.balance(customer.id)).toBeCloseTo(Number(after.finalTotal), 2)

    // Completion twice is idempotent (no double refund)
    const again = await returnService.resolveReturn(req.id, { status: 'completed', resolution_note: 'again' }, staff.id)
    expect(again.status).toBe('completed')
    expect(await walletService.balance(customer.id)).toBeCloseTo(Number(after.finalTotal), 2)
    expect(await PaymentEvent.countDocuments({ orderId: order.id, eventType: 'order_return_refund' })).toBe(1)
  })

  it('supports partial line return without marking the whole order returned', async () => {
    const product2 = await Product.create({
      name: 'Second Ring',
      slug: 'second-ring',
      brandId: (await Brand.findOne()).id,
      categoryId: (await Category.findOne()).id,
      status: 'active',
      metalType: 'gold',
      purity: '22k',
    })
    const variant2 = await Variant.create({
      productId: product2.id,
      sku: 'RET-2',
      label: '17',
      weightGrams: 3,
      effectiveWeight: 3,
      stockQty: 20,
      purity: '22k',
      isActive: true,
    })
    await CartItem.create({ customerId: customer.id, variantId: variant.id, qty: 1 })
    await CartItem.create({ customerId: customer.id, variantId: variant2.id, qty: 1 })
    const order = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'manual',
      wallet_use: 0,
      idempotency_key: 'ret-partial-1',
    })
    await orderService.markManualPaid(order.id, staff.id, { payment_mode: 'bank_transfer', transaction_ref: 'BT-3', amount_collected: Number(order.total) })
    const paid = await mongoose.model('Order').findByIdAndUpdate(
      order.id,
      { status: 'delivered', deliveredAt: new Date() },
      { new: true },
    )

    const itemId = String(paid.items[0].id)
    const req = await returnService.requestReturn(customer.id, {
      order_id: paid.id,
      kind: 'return',
      order_item_id: itemId,
      reason: 'size',
    })
    await returnService.resolveReturn(req.id, { status: 'approved' }, staff.id)
    await returnService.resolveReturn(req.id, { status: 'completed' }, staff.id)

    const after = await mongoose.model('Order').findById(paid.id)
    expect(after.status).toBe('partially_returned')
    expect(after.paymentStatus).toBe('partially_refunded')
    expect(after.items[0].returnedQty).toBe(1)
    expect(after.items[1].returnedQty).toBe(0)
    expect(after.refundedTotal).toBeGreaterThan(0)
    expect(after.refundedTotal).toBeLessThan(Number(after.finalTotal))
  })

  it('returns 1 of qty 3 then another 1, and rejects qty above remaining', async () => {
    await CartItem.create({ customerId: customer.id, variantId: variant.id, qty: 3 })
    const order = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'manual',
      wallet_use: 0,
      idempotency_key: 'ret-qty-3',
    })
    await orderService.markManualPaid(order.id, staff.id, { payment_mode: 'bank_transfer', transaction_ref: 'BT-Q', amount_collected: Number(order.total) })
    const paid = await mongoose.model('Order').findByIdAndUpdate(
      order.id,
      { status: 'delivered', deliveredAt: new Date() },
      { new: true },
    )
    const itemId = String(paid.items[0].id)
    const stockBefore = (await Variant.findById(variant.id)).stockQty

    const req1 = await returnService.requestReturn(customer.id, {
      order_id: paid.id,
      kind: 'return',
      order_item_id: itemId,
      requested_qty: 1,
      reason: 'first',
    })
    await returnService.resolveReturn(req1.id, { status: 'approved' }, staff.id)
    await returnService.resolveReturn(req1.id, { status: 'completed' }, staff.id)

    let after = await mongoose.model('Order').findById(paid.id)
    expect(after.status).toBe('partially_returned')
    expect(after.items[0].returnedQty).toBe(1)
    expect(after.paymentStatus).toBe('partially_refunded')
    const refund1 = Number(after.refundedTotal)
    expect(refund1).toBeGreaterThan(0)
    expect((await Variant.findById(variant.id)).stockQty).toBe(stockBefore + 1)

    await expect(returnService.requestReturn(customer.id, {
      order_id: paid.id,
      kind: 'return',
      order_item_id: itemId,
      requested_qty: 3,
      reason: 'too many',
    })).rejects.toMatchObject({ code: 'INVALID_RETURN_QTY' })

    const req2 = await returnService.requestReturn(customer.id, {
      order_id: paid.id,
      kind: 'return',
      order_item_id: itemId,
      requested_qty: 1,
      reason: 'second',
    })
    await returnService.resolveReturn(req2.id, { status: 'approved' }, staff.id)
    await returnService.resolveReturn(req2.id, { status: 'completed' }, staff.id)

    after = await mongoose.model('Order').findById(paid.id)
    expect(after.items[0].returnedQty).toBe(2)
    expect(after.status).toBe('partially_returned')
    expect(Number(after.refundedTotal)).toBeGreaterThan(refund1)
    expect(Number(after.refundedTotal)).toBeLessThan(Number(after.finalTotal))
    // Second unit refund ≈ remaining/remainingQty of first remaining
    expect(Number(after.refundedTotal)).toBeCloseTo(refund1 * 2, 1)
    expect((await Variant.findById(variant.id)).stockQty).toBe(stockBefore + 2)
  })

  it('completes concurrently only once for the same return request', async () => {
    await CartItem.create({ customerId: customer.id, variantId: variant.id, qty: 2 })
    const order = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'manual',
      wallet_use: 0,
      idempotency_key: 'ret-concurrent',
    })
    await orderService.markManualPaid(order.id, staff.id, { payment_mode: 'card', transaction_ref: 'CARD-C', amount_collected: Number(order.total) })
    const paid = await mongoose.model('Order').findByIdAndUpdate(
      order.id,
      { status: 'delivered', deliveredAt: new Date() },
      { new: true },
    )
    const req = await returnService.requestReturn(customer.id, {
      order_id: paid.id,
      kind: 'return',
      order_item_id: String(paid.items[0].id),
      requested_qty: 1,
      reason: 'race',
    })
    await returnService.resolveReturn(req.id, { status: 'approved' }, staff.id)

    const results = await Promise.allSettled([
      returnService.resolveReturn(req.id, { status: 'completed' }, staff.id),
      returnService.resolveReturn(req.id, { status: 'completed' }, staff.id),
    ])
    const ok = results.filter((row) => row.status === 'fulfilled')
    expect(ok.length).toBeGreaterThanOrEqual(1)
    expect(ok.every((row) => row.value.status === 'completed')).toBe(true)

    const after = await mongoose.model('Order').findById(paid.id)
    expect(after.items[0].returnedQty).toBe(1)
    expect(await PaymentEvent.countDocuments({ orderId: paid.id, eventType: 'order_return_refund' })).toBe(1)
  })

  it('rejects a second active whole-order return', async () => {
    await CartItem.create({ customerId: customer.id, variantId: variant.id, qty: 1 })
    const order = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'manual',
      wallet_use: 0,
      idempotency_key: 'ret-whole-dup',
    })
    await orderService.markManualPaid(order.id, staff.id, { payment_mode: 'card', transaction_ref: 'CARD-W', amount_collected: Number(order.total) })
    await mongoose.model('Order').findByIdAndUpdate(order.id, { status: 'delivered', deliveredAt: new Date() })

    await returnService.requestReturn(customer.id, {
      order_id: order.id, kind: 'return', reason: 'first',
    })
    await expect(returnService.requestReturn(customer.id, {
      order_id: order.id, kind: 'return', reason: 'second',
    })).rejects.toMatchObject({ code: 'RETURN_ALREADY_OPEN' })
  })

  it('cannot over-reserve the same line under concurrent return requests', async () => {
    await CartItem.create({ customerId: customer.id, variantId: variant.id, qty: 2 })
    const order = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'manual',
      wallet_use: 0,
      idempotency_key: 'ret-reserve-race',
    })
    await orderService.markManualPaid(order.id, staff.id, { payment_mode: 'card', transaction_ref: 'CARD-R', amount_collected: Number(order.total) })
    const paid = await mongoose.model('Order').findByIdAndUpdate(
      order.id,
      { status: 'delivered', deliveredAt: new Date() },
      { new: true },
    )
    const itemId = String(paid.items[0].id)
    const results = await Promise.allSettled([
      returnService.requestReturn(customer.id, {
        order_id: paid.id, kind: 'return', order_item_id: itemId, requested_qty: 2, reason: 'a',
      }),
      returnService.requestReturn(customer.id, {
        order_id: paid.id, kind: 'return', order_item_id: itemId, requested_qty: 2, reason: 'b',
      }),
    ])
    const ok = results.filter((row) => row.status === 'fulfilled')
    const fail = results.filter((row) => row.status === 'rejected')
    expect(ok).toHaveLength(1)
    expect(fail.length).toBeGreaterThanOrEqual(1)
    const after = await mongoose.model('Order').findById(paid.id)
    expect(Number(after.items[0].reservedReturnQty)).toBe(2)
  })
})
