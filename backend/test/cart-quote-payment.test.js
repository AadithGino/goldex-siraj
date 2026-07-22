import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Customer } from '../src/models/auth.models.js'
import { Brand, Category, Product, ProductImage, StoreSetting, TaxSetting, Variant } from '../src/models/catalog.models.js'
import { Address, CartItem, Coupon, PaymentEvent } from '../src/models/commerce.models.js'
import { GoldRate } from '../src/models/rate.models.js'
import { Staff } from '../src/models/auth.models.js'
import { hashPassword } from '../src/services/auth.service.js'
import * as orderService from '../src/services/order.service.js'
import { quoteCustomerCart } from '../src/services/pricing.service.js'

let mongoServer
let customer
let staff
let address
let brand
let category

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-quote-payment'))
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

async function makeVariant({ purity, sku, taxTreatment = 'standard', weight = 4 }) {
  const product = await Product.create({
    name: `P-${sku}`,
    slug: `p-${sku.toLowerCase()}`,
    brandId: brand.id,
    categoryId: category.id,
    status: 'active',
    metalType: 'gold',
    purity,
    taxTreatment,
  })
  const variant = await Variant.create({
    productId: product.id,
    sku,
    label: purity,
    weightGrams: weight,
    effectiveWeight: weight,
    stockQty: 20,
    purity,
    taxTreatment,
    isActive: true,
  })
  await ProductImage.create({ productId: product.id, imageUrl: `https://cdn.example.com/${sku}.jpg`, isPrimary: true })
  return variant
}

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
  await GoldRate.create({ purity: '24k', ratePerGram: 300, isCurrent: true, effectiveAt: new Date() })
  await GoldRate.create({ purity: '22k', ratePerGram: 250, isCurrent: true, effectiveAt: new Date() })
  await GoldRate.create({ purity: '18k', ratePerGram: 200, isCurrent: true, effectiveAt: new Date() })
  customer = await Customer.create({ phone: '+971501222001', fullName: 'Quote User', authProvider: 'otp' })
  staff = await Staff.create({
    fullName: 'Manager',
    email: 'quote-mgr@example.com',
    passwordHash: await hashPassword('password-12345678'),
    role: 'manager',
  })
  address = await Address.create({
    customerId: customer.id,
    recipientName: 'Quote User',
    phone: '+971501222001',
    line1: 'Marina',
    city: 'Dubai',
    state: 'Dubai',
    country: 'UAE',
  })
  brand = await Brand.create({ name: 'Q', slug: 'q-brand', isActive: true })
  category = await Category.create({ name: 'C', slug: 'q-cat', isActive: true })
})

describe('cart quote', () => {
  it('quotes 24KT-only with VAT 0 and matches placeOrder totals', async () => {
    const v24 = await makeVariant({ purity: '24k', sku: 'Q24' })
    await CartItem.create({ customerId: customer.id, variantId: v24.id, qty: 1 })
    const quote = await quoteCustomerCart(customer.id, {})
    expect(quote.totals.tax_amount).toBe(0)
    expect(quote.totals.zero_rated_total).toBeGreaterThan(0)
    expect(quote.totals.tax_breakdown.vat_total).toBe(0)

    const order = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'cod',
      wallet_use: 0,
      idempotency_key: 'quote-24-1',
    })
    expect(Number(order.taxAmount)).toBe(Number(quote.totals.tax_amount))
    expect(Number(order.total)).toBe(Number(quote.totals.total))
  })

  it('quotes mixed 24KT/22KT and taxes only 22KT', async () => {
    const v24 = await makeVariant({ purity: '24k', sku: 'QM24' })
    const v22 = await makeVariant({ purity: '22k', sku: 'QM22' })
    await CartItem.create([
      { customerId: customer.id, variantId: v24.id, qty: 1 },
      { customerId: customer.id, variantId: v22.id, qty: 1 },
    ])
    const quote = await quoteCustomerCart(customer.id, {})
    expect(quote.totals.zero_rated_total).toBeGreaterThan(0)
    expect(quote.totals.standard_rated_total).toBeGreaterThan(0)
    expect(quote.totals.tax_amount).toBeGreaterThan(0)
    const zeroLine = quote.lines.find((l) => l.breakup.purity === '24k')
    const stdLine = quote.lines.find((l) => l.breakup.purity === '22k')
    expect(zeroLine.breakup.vat_amount).toBe(0)
    expect(stdLine.breakup.vat_amount).toBeGreaterThan(0)
  })

  it('quotes mixed 24KT/18KT and applies percentage coupon without taxing 24KT', async () => {
    const v24 = await makeVariant({ purity: '24k', sku: 'QC24' })
    const v18 = await makeVariant({ purity: '18k', sku: 'QC18' })
    await CartItem.create([
      { customerId: customer.id, variantId: v24.id, qty: 1 },
      { customerId: customer.id, variantId: v18.id, qty: 1 },
    ])
    await Coupon.create({
      code: 'MIX10',
      discountType: 'percent',
      discountValue: 10,
      minOrder: 0,
      usageLimit: 100,
      perCustomerLimit: 5,
      isActive: true,
      validFrom: new Date(Date.now() - 60_000),
      validTo: null,
    })
    const quote = await quoteCustomerCart(customer.id, { coupon_code: 'MIX10' })
    expect(quote.coupon.code).toBe('MIX10')
    expect(quote.totals.discount_amount).toBeGreaterThan(0)
    const zeroLine = quote.lines.find((l) => l.breakup.purity === '24k')
    expect(zeroLine.breakup.tax_treatment).toBe('zero_rated')
    expect(zeroLine.breakup.vat_amount).toBe(0)

    const order = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'manual',
      coupon_code: 'MIX10',
      wallet_use: 0,
      idempotency_key: 'quote-mix-coupon-1',
    })
    expect(Number(order.total)).toBe(Number(quote.totals.total))
    expect(Number(order.taxAmount)).toBe(Number(quote.totals.tax_amount))
  })

  it('does not reserve coupon usage on quote', async () => {
    const v22 = await makeVariant({ purity: '22k', sku: 'QR22' })
    await CartItem.create({ customerId: customer.id, variantId: v22.id, qty: 1 })
    const coupon = await Coupon.create({
      code: 'ONCE1',
      discountType: 'flat',
      discountValue: 10,
      minOrder: 0,
      usageLimit: 1,
      usedCount: 0,
      perCustomerLimit: 1,
      isActive: true,
      validFrom: new Date(Date.now() - 60_000),
    })
    await quoteCustomerCart(customer.id, { coupon_code: 'ONCE1' })
    const refreshed = await Coupon.findById(coupon.id)
    expect(refreshed.usedCount).toBe(0)
  })
})

describe('COD vs manual payment semantics', () => {
  it('manual payment preserves placement snapshots after rate change; COD reprices', async () => {
    const v24 = await makeVariant({ purity: '24k', sku: 'PAY24' })
    const v22 = await makeVariant({ purity: '22k', sku: 'PAY22' })
    await CartItem.create([
      { customerId: customer.id, variantId: v24.id, qty: 1 },
      { customerId: customer.id, variantId: v22.id, qty: 1 },
    ])

    const manual = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'manual',
      wallet_use: 0,
      idempotency_key: 'manual-lock-1',
    })
    expect(manual.pricingMode).toBe('manual_locked')
    const lockedTotal = Number(manual.total)
    const lockedTax = Number(manual.taxAmount)
    const locked24Vat = manual.items.find((i) => i.purity === '24k').breakup.vat_amount

    await CartItem.create([
      { customerId: customer.id, variantId: v24.id, qty: 1 },
      { customerId: customer.id, variantId: v22.id, qty: 1 },
    ])
    const cod = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'cod',
      wallet_use: 0,
      idempotency_key: 'cod-reprice-1',
    })
    await orderService.updateStatus(cod.id, 'confirmed', null, staff.id)
    await orderService.updateStatus(cod.id, 'processing', null, staff.id)
    await orderService.updateStatus(cod.id, 'shipped', null, staff.id)

    await GoldRate.updateMany({ isCurrent: true }, { $set: { isCurrent: false } })
    await GoldRate.create({ purity: '24k', ratePerGram: 400, isCurrent: true, effectiveAt: new Date() })
    await GoldRate.create({ purity: '22k', ratePerGram: 350, isCurrent: true, effectiveAt: new Date() })
    await GoldRate.create({ purity: '18k', ratePerGram: 280, isCurrent: true, effectiveAt: new Date() })

    const paidManual = await orderService.markManualPaid(manual.id, staff.id, {
      payment_mode: 'bank_transfer',
      transaction_ref: 'TRX-LOCK-1',
      amount_collected: lockedTotal,
    })
    expect(Number(paidManual.total)).toBe(lockedTotal)
    expect(Number(paidManual.taxAmount)).toBe(lockedTax)
    expect(paidManual.items.find((i) => i.purity === '24k').breakup.vat_amount).toBe(locked24Vat)
    expect(paidManual.paymentCollection.transactionRef).toBe('TRX-LOCK-1')
    expect(Number(paidManual.paymentCollection.expectedAmount)).toBe(lockedTotal)
    expect(Number(paidManual.paymentCollection.amount)).toBe(lockedTotal)

    let expectedCod
    try {
      await orderService.finalizeCodHandover(cod.id, staff.id, { amount_collected: 0.01 })
    } catch (error) {
      expect(error.code).toBe('AMOUNT_MISMATCH')
      expectedCod = error.details.expected_amount
    }
    expect(expectedCod).toBeGreaterThan(0)
    const paidCod = await orderService.finalizeCodHandover(cod.id, staff.id, {
      amount_collected: expectedCod,
    })
    expect(Number(paidCod.total)).not.toBe(Number(cod.total))
    expect(paidCod.items.find((i) => i.purity === '24k').breakup.vat_amount).toBe(0)
    expect(paidCod.items.find((i) => i.purity === '24k').breakup.tax_treatment).toBe('zero_rated')
  })

  it('rejects incorrect COD and manual amounts; accepts aliases', async () => {
    const v22 = await makeVariant({ purity: '22k', sku: 'AMT22' })
    await CartItem.create({ customerId: customer.id, variantId: v22.id, qty: 1 })
    const manual = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'manual',
      wallet_use: 0,
      idempotency_key: 'amt-manual-1',
    })
    await expect(orderService.markManualPaid(manual.id, staff.id, {
      payment_mode: 'bank_transfer',
      transaction_ref: 'BAD-1',
      amount: Number(manual.total) + 5,
    })).rejects.toMatchObject({ code: 'AMOUNT_MISMATCH' })

    await expect(orderService.markManualPaid(manual.id, staff.id, {
      payment_mode: 'bank_transfer',
      transaction_ref: 'MISS-1',
    })).rejects.toMatchObject({ code: 'AMOUNT_REQUIRED' })

    const ok = await orderService.markManualPaid(manual.id, staff.id, {
      payment_mode: 'bank_transfer',
      transaction_ref: 'OK-ALIAS',
      amountCollected: Number(manual.total),
    })
    expect(ok.paymentStatus).toBe('paid')
    expect(await PaymentEvent.countDocuments({ orderId: manual.id })).toBe(1)

    await CartItem.create({ customerId: customer.id, variantId: v22.id, qty: 1 })
    const cod = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'cod',
      wallet_use: 0,
      idempotency_key: 'amt-cod-1',
    })
    await orderService.updateStatus(cod.id, 'confirmed', null, staff.id)
    await orderService.updateStatus(cod.id, 'processing', null, staff.id)
    await orderService.updateStatus(cod.id, 'shipped', null, staff.id)

    await expect(orderService.finalizeCodHandover(cod.id, staff.id, {
      amount_collected: 1,
    })).rejects.toMatchObject({ code: 'AMOUNT_MISMATCH' })

    let expected
    try {
      await orderService.finalizeCodHandover(cod.id, staff.id, { amount_collected: 1 })
    } catch (error) {
      expected = error.details.expected_amount
    }
    const paid = await orderService.finalizeCodHandover(cod.id, staff.id, {
      amountCollected: expected,
    })
    expect(paid.paymentStatus).toBe('paid')
    expect(paid.items.find((i) => i.purity === '22k')).toBeTruthy()
  })

  it('concurrent manual payment confirmation creates one payment event', async () => {
    const v22 = await makeVariant({ purity: '22k', sku: 'CONC22' })
    await CartItem.create({ customerId: customer.id, variantId: v22.id, qty: 1 })
    const order = await orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'manual',
      wallet_use: 0,
      idempotency_key: 'manual-conc-1',
    })
    const results = await Promise.allSettled([
      orderService.markManualPaid(order.id, staff.id, {
        payment_mode: 'card',
        transaction_ref: 'CARD-1',
        amount_collected: Number(order.total),
      }),
      orderService.markManualPaid(order.id, staff.id, {
        payment_mode: 'card',
        transaction_ref: 'CARD-1',
        amount_collected: Number(order.total),
      }),
      orderService.markManualPaid(order.id, staff.id, {
        payment_mode: 'card',
        transaction_ref: 'CARD-1',
        amount_collected: Number(order.total),
      }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3)
    expect(await PaymentEvent.countDocuments({ orderId: order.id, eventType: 'manual_payment_verified' })).toBe(1)
  })
})
