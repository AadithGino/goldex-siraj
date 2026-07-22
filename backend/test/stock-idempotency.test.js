import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Staff } from '../src/models/auth.models.js'
import { Brand, Category, Product, Variant } from '../src/models/catalog.models.js'
import { StockMovement } from '../src/models/rate.models.js'
import { hashPassword } from '../src/services/auth.service.js'
import * as catalogService from '../src/services/catalog.service.js'
import { applyStockDelta, adjustStock } from '../src/services/inventory.service.js'

let mongoServer
let staff
let product
let variant

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-stock-idempotency'))
  await StockMovement.syncIndexes()
  await Variant.syncIndexes()
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})))
  staff = await Staff.create({
    fullName: 'Manager',
    email: 'stock-idemp@example.com',
    passwordHash: await hashPassword('password-12345678'),
    role: 'manager',
  })
  const brand = await Brand.create({ name: 'B', slug: 'b-stock-idemp', isActive: true })
  const category = await Category.create({ name: 'C', slug: 'c-stock-idemp', isActive: true })
  product = await Product.create({
    name: 'Stock Ring',
    slug: 'stock-idemp-ring',
    brandId: brand.id,
    categoryId: category.id,
    status: 'active',
    metalType: 'gold',
    purity: '22k',
  })
  variant = await Variant.create({
    productId: product.id,
    sku: 'STOCK-IDEMP-1',
    label: '16',
    weightGrams: 4,
    effectiveWeight: 4,
    stockQty: 10,
    purity: '22k',
    isActive: true,
  })
})

describe('stock movement idempotency', () => {
  it('applyStockDelta with the same key is a no-op on retry', async () => {
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        await applyStockDelta({
          variantId: variant.id,
          delta: -2,
          reason: 'admin_adjustment',
          idempotencyKey: 'adj-once-1',
          actorId: staff.id,
          session,
        })
        await applyStockDelta({
          variantId: variant.id,
          delta: -2,
          reason: 'admin_adjustment',
          idempotencyKey: 'adj-once-1',
          actorId: staff.id,
          session,
        })
      })
    } finally {
      session.endSession()
    }

    const fresh = await Variant.findById(variant.id)
    expect(fresh.stockQty).toBe(8)
    expect(await StockMovement.countDocuments({ idempotencyKey: 'adj-once-1' })).toBe(1)
  })

  it('concurrent adjustStock with the same key applies once', async () => {
    const results = await Promise.all([
      adjustStock(variant.id, -3, 'admin_adjustment', 'race', staff.id, { idempotencyKey: 'adj-race-1' }),
      adjustStock(variant.id, -3, 'admin_adjustment', 'race', staff.id, { idempotencyKey: 'adj-race-1' }),
    ])
    expect(results.every((row) => Number(row.stockQty) === 7)).toBe(true)
    expect(await StockMovement.countDocuments({ idempotencyKey: 'adj-race-1' })).toBe(1)
    expect((await Variant.findById(variant.id)).stockQty).toBe(7)
  })

  it('createVariantComplete identical concurrent retries return the same variant', async () => {
    const payload = {
      product_id: product.id,
      sku: 'CREATE-IDEMP-A',
      label: '18',
      purity: '22k',
      weight_grams: 5,
      effective_weight: 5,
      stock_qty: 4,
      idempotency_key: 'create-stock-idemp-1',
    }
    const [a, b] = await Promise.all([
      catalogService.createVariantComplete(payload, staff.id),
      catalogService.createVariantComplete(payload, staff.id),
    ])
    expect(String(a._id || a.id)).toBe(String(b._id || b.id))
    expect(await Variant.countDocuments({ 'metadata.idempotencyKey': 'create-stock-idemp-1' })).toBe(1)
    expect(await StockMovement.countDocuments({ idempotencyKey: 'create-stock-idemp-1:stock' })).toBe(1)
  })

  it('createVariantComplete mismatched payload with same key conflicts', async () => {
    await catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'CREATE-IDEMP-A',
      label: '18',
      purity: '22k',
      weight_grams: 5,
      effective_weight: 5,
      stock_qty: 4,
      idempotency_key: 'create-stock-idemp-conflict',
    }, staff.id)
    await expect(catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'CREATE-IDEMP-B',
      label: '18',
      purity: '22k',
      weight_grams: 5,
      effective_weight: 5,
      stock_qty: 9,
      idempotency_key: 'create-stock-idemp-conflict',
    }, staff.id)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  })

  it('updateVariantComplete requires an idempotency key for stock mutations', async () => {
    await expect(catalogService.updateVariantComplete(variant.id, {
      stock_qty: 12,
      expected_stock_qty: 10,
    }, staff.id)).rejects.toMatchObject({ code: 'IDEMPOTENCY_REQUIRED' })
  })

  it('updateVariantComplete stock mutation is idempotent per key', async () => {
    await catalogService.updateVariantComplete(variant.id, {
      stock_qty: 15,
      expected_stock_qty: 10,
      idempotency_key: 'update-stock-1',
    }, staff.id)
    const again = await catalogService.updateVariantComplete(variant.id, {
      stock_qty: 15,
      expected_stock_qty: 10,
      idempotency_key: 'update-stock-1',
    }, staff.id)
    expect(Number(again.stockQty ?? again.stock_qty)).toBe(15)
    expect((await Variant.findById(variant.id)).stockQty).toBe(15)
    expect(await StockMovement.countDocuments({ idempotencyKey: 'update-stock-1:stock' })).toBe(1)
  })

  it('setStock accepts frontend admin_adjustment payload with idempotency key', async () => {
    const { setStock } = await import('../src/services/inventory.service.js')
    const first = await setStock(variant.id, {
      qty: 20,
      expectedBefore: 10,
      reason: 'admin_adjustment',
      note: 'admin set',
      actorId: staff.id,
      idempotencyKey: 'fe-set-1',
    })
    expect(first.stockQty).toBe(20)
    const retry = await setStock(variant.id, {
      qty: 20,
      expectedBefore: 10,
      reason: 'admin_adjustment',
      note: 'admin set',
      actorId: staff.id,
      idempotencyKey: 'fe-set-1',
    })
    expect(retry.stockQty).toBe(20)
    expect(await StockMovement.countDocuments({ idempotencyKey: 'fe-set-1' })).toBe(1)

    await setStock(variant.id, {
      qty: 25,
      expectedBefore: 20,
      reason: 'admin_adjustment',
      actorId: staff.id,
      idempotencyKey: 'fe-set-2',
    })
    expect((await Variant.findById(variant.id)).stockQty).toBe(25)

    await expect(setStock(variant.id, {
      qty: 30,
      expectedBefore: 20,
      reason: 'admin_adjustment',
      actorId: staff.id,
      idempotencyKey: 'fe-set-stale',
    })).rejects.toMatchObject({ code: 'STOCK_VERSION_CONFLICT' })

    await expect(setStock(variant.id, {
      qty: 99,
      expectedBefore: 25,
      reason: 'admin_adjustment',
      actorId: staff.id,
      idempotencyKey: 'fe-set-1',
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })

    const ledger = await StockMovement.find({ variantId: variant.id }).sort({ createdAt: 1 })
    expect(ledger.some((row) => row.qtyBefore === 10 && row.qtyAfter === 20)).toBe(true)
    expect(ledger.some((row) => row.qtyBefore === 20 && row.qtyAfter === 25)).toBe(true)
  })
})
