import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Customer } from '../src/models/auth.models.js'
import { Brand, Category, Product, ProductImage, StoreSetting, TaxSetting, Variant } from '../src/models/catalog.models.js'
import { Address, CartItem, WalletAccount } from '../src/models/commerce.models.js'
import { GoldRate } from '../src/models/rate.models.js'
import * as orderService from '../src/services/order.service.js'
import * as walletService from '../src/services/wallet.service.js'

let mongoServer
let customer
let address
let variant

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-wallet-test'))
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
  customer = await Customer.create({ phone: '+971501000333', fullName: 'Wallet User', authProvider: 'otp' })
  address = await Address.create({
    customerId: customer.id,
    recipientName: 'Wallet User',
    phone: '+971501000333',
    line1: 'Marina',
    city: 'Dubai',
    state: 'Dubai',
    country: 'United Arab Emirates',
  })
  const brand = await Brand.create({ name: 'Goldex', slug: 'goldex-w', isActive: true })
  const category = await Category.create({ name: 'Rings', slug: 'rings-w', isActive: true })
  const product = await Product.create({
    name: 'Wallet Ring',
    slug: 'wallet-ring',
    brandId: brand.id,
    categoryId: category.id,
    status: 'active',
    metalType: 'gold',
    purity: '22k',
  })
  variant = await Variant.create({
    productId: product.id,
    sku: 'W-RING-1',
    label: '16',
    weightGrams: 2,
    effectiveWeight: 2,
    stockQty: 20,
    purity: '22k',
    isActive: true,
  })
  await ProductImage.create({ productId: product.id, imageUrl: 'https://cdn.example.com/w.jpg', isPrimary: true, displayOrder: 0 })
  await walletService.credit({
    customerId: customer.id,
    amount: 50,
    type: 'adjustment',
    referenceType: 'test',
    referenceId: customer.id,
    idempotencyKey: `seed-wallet:${customer.id}`,
    note: 'seed',
  })
})

describe('atomic wallet', () => {
  it('prevents concurrent checkouts from spending the same balance twice', async () => {
    await CartItem.create({ customerId: customer.id, variantId: variant.id, qty: 1 })
    const cart2 = await CartItem.create({ customerId: customer.id, variantId: variant.id, qty: 1 }).catch(() => null)
    // cart unique on customer+variant — place two orders sequentially with parallel debit instead
    const results = await Promise.allSettled([
      walletService.debit({
        customerId: customer.id,
        amount: 40,
        idempotencyKey: 'debit-a',
        type: 'purchase',
        referenceType: 'test',
        referenceId: customer.id,
        note: 'a',
      }),
      walletService.debit({
        customerId: customer.id,
        amount: 40,
        idempotencyKey: 'debit-b',
        type: 'purchase',
        referenceType: 'test',
        referenceId: customer.id,
        note: 'b',
      }),
    ])
    const fulfilled = results.filter((item) => item.status === 'fulfilled')
    const rejected = results.filter((item) => item.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0].reason.code).toBe('INSUFFICIENT_WALLET')
    expect(await walletService.balance(customer.id)).toBe(10)
    expect((await WalletAccount.findOne({ customerId: customer.id })).balance).toBe(10)
    void cart2
  })

  it('is idempotent for the same debit key', async () => {
    await walletService.debit({
      customerId: customer.id,
      amount: 20,
      idempotencyKey: 'debit-once',
      type: 'purchase',
      referenceType: 'test',
      referenceId: customer.id,
      note: 'once',
    })
    await walletService.debit({
      customerId: customer.id,
      amount: 20,
      idempotencyKey: 'debit-once',
      type: 'purchase',
      referenceType: 'test',
      referenceId: customer.id,
      note: 'once',
    })
    expect(await walletService.balance(customer.id)).toBe(30)
  })

  it('rejects COD below configured minimum on placeOrder', async () => {
    await StoreSetting.updateOne({ singleton: 'default' }, { $set: { codMinOrderAmount: 10_000 } })
    await CartItem.create({ customerId: customer.id, variantId: variant.id, qty: 1 })
    await expect(orderService.placeOrder(customer.id, {
      address_id: address.id,
      payment_method: 'cod',
      wallet_use: 0,
      idempotency_key: 'cod-min-1',
    })).rejects.toMatchObject({ code: 'COD_BELOW_MINIMUM' })
  })
})
