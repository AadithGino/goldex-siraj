import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Customer, Staff } from '../src/models/auth.models.js'
import { Brand, Category, Product, ProductImage, StoreSetting, TaxSetting, Variant } from '../src/models/catalog.models.js'
import { Address, CartItem, Coupon } from '../src/models/commerce.models.js'
import { GoldRate } from '../src/models/rate.models.js'
import { hashPassword } from '../src/services/auth.service.js'
import * as orderService from '../src/services/order.service.js'
import { toCustomerOrderDto, maskTransactionRef } from '../src/utils/customerOrderDto.js'

let mongoServer
let customer
let staff
let address
let variant
let product

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-orders-test'))
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

  customer = await Customer.create({ phone: '+971501000111', fullName: 'Order Buyer', authProvider: 'otp' })
  staff = await Staff.create({
    fullName: 'Cashier',
    email: 'cashier@example.com',
    passwordHash: await hashPassword('password-12345678'),
    role: 'manager',
  })
  address = await Address.create({
    customerId: customer.id,
    recipientName: 'Order Buyer',
    phone: '+971501000111',
    line1: 'Marina Walk',
    city: 'Dubai',
    state: 'Dubai',
    country: 'United Arab Emirates',
  })

  const brand = await Brand.create({ name: 'Goldex', slug: 'goldex', isActive: true })
  const category = await Category.create({ name: 'Rings', slug: 'rings', isActive: true })
  product = await Product.create({
    name: 'Classic Ring',
    nameAr: 'خاتم',
    slug: 'classic-ring',
    brandId: brand.id,
    categoryId: category.id,
    status: 'active',
    metalType: 'gold',
    metalColor: 'yellow',
    purity: '22k',
  })
  variant = await Variant.create({
    productId: product.id,
    sku: 'RING-22K-01',
    label: 'Size 16',
    labelAr: 'مقاس 16',
    weightGrams: 4,
    effectiveWeight: 3.8,
    stockQty: 10,
    purity: '22k',
    isActive: true,
  })
  await ProductImage.create({
    productId: product.id,
    imageUrl: 'https://cdn.example.com/ring.jpg',
    isPrimary: true,
    displayOrder: 0,
  })
})

async function seedCart(qty = 1) {
  await CartItem.create({ customerId: customer.id, variantId: variant.id, qty })
}

describe('order placement and customer DTO', () => {
  it('places an order with nonempty item snapshots including image/sku/variant', async () => {
    await seedCart(2)
    const order = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'cod',
      wallet_use: 0,
      idempotency_key: 'place-1',
    })

    expect(order.items).toHaveLength(1)
    expect(order.items[0]).toMatchObject({
      productName: 'Classic Ring',
      sku: 'RING-22K-01',
      variantLabel: 'Size 16',
      imageUrl: 'https://cdn.example.com/ring.jpg',
      productSlug: 'classic-ring',
      qty: 2,
    })
    expect(order.amountDue).toBeGreaterThan(0)
  })

  it('returns items on customer list/detail and hides staff payment internals', async () => {
    await seedCart(1)
    const placed = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'manual',
      wallet_use: 0,
      idempotency_key: 'manual-1',
    })

    const listed = await orderService.listCustomerOrders(customer.id)
    const listDto = toCustomerOrderDto(listed.orders[0], {
      returns: listed.orders[0].returns || [],
      displayImageByProductId: listed.displayImageByProductId,
    })
    expect(listDto.items).toHaveLength(1)
    expect(listDto.items[0].image_url).toBe('https://cdn.example.com/ring.jpg')

    await orderService.markManualPaid(placed.id, staff.id, {
      payment_mode: 'bank_transfer',
      transaction_ref: 'ABC123456789',
      note: 'Internal staff note',
      amount_collected: Number(placed.total),
    })

    const detail = await orderService.getCustomerOrder(customer.id, placed.id)
    const dto = toCustomerOrderDto(detail.order, {
      returns: detail.order.returns || [],
      displayImageByProductId: detail.displayImageByProductId,
    })
    expect(dto.items).toHaveLength(1)
    expect(dto.payment_status).toBe('paid')
    expect(dto.paid_at).toBeTruthy()
    expect(dto.finalized_at).toBeTruthy()
    expect(dto.payment_mode).toBe('bank_transfer')
    expect(dto.invoice_number).toMatch(/^INV-/)
    expect(dto.amount_due).toBe(0)
    expect(dto.payment_collection.amount).toBeGreaterThan(0)
    expect(dto.payment_collection.transaction_ref_masked).toBe('••••6789')
    expect(dto.payment_collection).not.toHaveProperty('note')
    expect(dto.payment_collection).not.toHaveProperty('collected_by')
    expect(JSON.stringify(dto)).not.toContain('Internal staff note')
    expect(JSON.stringify(dto)).not.toContain(String(staff.id))
  })

  it('prevents customers from reading another customer order', async () => {
    await seedCart(1)
    const placed = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'cod',
      wallet_use: 0,
      idempotency_key: 'cod-other',
    })
    const other = await Customer.create({ phone: '+971509999888', authProvider: 'otp' })
    await expect(orderService.getCustomerOrder(other.id, placed.id)).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' })
  })

  it('sets COD handover fields and amount_due=0', async () => {
    await seedCart(1)
    const placed = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'cod',
      wallet_use: 0,
      idempotency_key: 'cod-handover',
    })
    placed.status = 'shipped'
    placed.statusHistory.push({ status: 'shipped', note: 'Shipped' })
    await placed.save()

    const paid = await orderService.finalizeCodHandover(placed.id, staff.id, { amount_collected: Number(placed.total) })
    expect(paid.paymentStatus).toBe('paid')
    expect(paid.paymentMode).toBe('cash')
    expect(paid.amountDue).toBe(0)
    expect(paid.paymentCollection.amount).toBeGreaterThan(0)
    expect(paid.paidAt).toBeTruthy()
    expect(paid.finalizedAt).toBeTruthy()
    expect(paid.deliveredAt).toBeTruthy()
    expect(paid.invoiceNumber).toBeTruthy()
    expect(paid.status).toBe('delivered')
  })

  it('keeps coupon discount after the coupon is deactivated', async () => {
    const coupon = await Coupon.create({
      code: 'GOLD10',
      discountType: 'flat',
      discountValue: 25,
      isActive: true,
      minOrder: 0,
    })
    await seedCart(1)
    const placed = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'manual',
      coupon_code: 'GOLD10',
      wallet_use: 0,
      idempotency_key: 'coupon-1',
    })
    expect(placed.couponCode).toBe('GOLD10')
    expect(placed.couponSnapshot.code).toBe('GOLD10')
    expect(placed.discountAmount).toBe(25)

    coupon.isActive = false
    await coupon.save()

    const paid = await orderService.markManualPaid(placed.id, staff.id, {
      payment_mode: 'card',
      transaction_ref: 'CARD9999',
      amount_collected: Number(placed.total),
    })
    expect(paid.discountAmount).toBe(25)
    expect(paid.couponCode).toBe('GOLD10')
    expect(paid.amountDue).toBe(0)
  })

  it('masks transaction references', () => {
    expect(maskTransactionRef('ABC123456789')).toBe('••••6789')
    expect(maskTransactionRef('AB')).toBe('••••')
  })

  it('keeps totals consistent with wallet/shipping/tax', async () => {
    await seedCart(1)
    const order = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'cod',
      wallet_use: 0,
      idempotency_key: 'totals-1',
    })
    expect(order.subtotal).toBeGreaterThan(0)
    expect(order.taxAmount).toBeGreaterThan(0)
    expect(order.shippingFee).toBe(25)
    expect(order.total).toBe(order.estimatedTotal)
    expect(order.amountDue).toBe(order.total)
  })
})

describe('admin order access', () => {
  it('includes payment events on admin detail', async () => {
    await seedCart(1)
    const placed = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'manual',
      wallet_use: 0,
      idempotency_key: 'admin-1',
    })
    await orderService.markManualPaid(placed.id, staff.id, {
      payment_mode: 'bank_transfer',
      transaction_ref: 'ADMINREF01',
      amount_collected: Number(placed.total),
    })
    const admin = await orderService.getAdminOrder(placed.id)
    expect(admin.payment_events?.length || admin.paymentEvents?.length).toBeGreaterThan(0)
  })
})
