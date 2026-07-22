import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Staff } from '../src/models/auth.models.js'
import { Brand, Category, Product, ProductImage, ProductStone, Variant } from '../src/models/catalog.models.js'
import { StockMovement } from '../src/models/rate.models.js'
import { hashPassword } from '../src/services/auth.service.js'
import * as catalogService from '../src/services/catalog.service.js'

let mongoServer
let staff
let product

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-catalog-aggregate'))
  await Variant.syncIndexes()
  await StockMovement.syncIndexes()
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})))
  staff = await Staff.create({
    fullName: 'Manager',
    email: 'catalog@example.com',
    passwordHash: await hashPassword('password-12345678'),
    role: 'manager',
  })
  const brand = await Brand.create({ name: 'B', slug: 'b-agg', isActive: true })
  const category = await Category.create({ name: 'C', slug: 'c-agg', isActive: true })
  product = await Product.create({
    name: 'Agg Ring',
    slug: 'agg-ring',
    brandId: brand.id,
    categoryId: category.id,
    status: 'active',
    metalType: 'gold',
    purity: '22k',
  })
})

describe('variant aggregate operations', () => {
  const fixedStone = (type, count = 1) => ({
    pricing_mode: 'fixed',
    stone_type: type,
    label: type,
    unit: 'piece',
    stone_count: count,
    manual_charge: 25,
  })

  it('creates variant, stones and stock in one transaction', async () => {
    const created = await catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'AGG-1',
      label: '16',
      purity: '22k',
      weight_grams: 5,
      effective_weight: 5,
      stock_qty: 3,
      stock_idempotency_key: 'create-variant-agg-1:stock',
      product_stones: [fixedStone('diamond', 2)],
      idempotency_key: 'create-variant-agg-1',
    }, staff.id)

    expect(created.sku).toBe('AGG-1')
    expect(created.stockQty).toBe(3)
    expect(created.product_stones).toHaveLength(1)
    expect(await StockMovement.countDocuments({ variantId: created._id || created.id })).toBe(1)

    await expect(catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'AGG-1-DUP',
      label: '16',
      purity: '22k',
      weight_grams: 5,
      effective_weight: 5,
      stock_qty: 9,
      stock_idempotency_key: 'create-variant-agg-1:stock-b',
      idempotency_key: 'create-variant-agg-1',
    }, staff.id)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  })

  it('identical create replay is idempotent', async () => {
    const payload = {
      product_id: product.id,
      sku: 'AGG-IDEMP',
      label: '16',
      purity: '22k',
      weight_grams: 5,
      effective_weight: 5,
      stock_qty: 2,
      stock_idempotency_key: 'create-variant-idem:stock',
      product_stones: [fixedStone('ruby', 1)],
      idempotency_key: 'create-variant-idem',
    }
    const first = await catalogService.createVariantComplete(payload, staff.id)
    const second = await catalogService.createVariantComplete(payload, staff.id)
    expect(String(second._id || second.id)).toBe(String(first._id || first.id))
    expect(second.stockQty).toBe(2)
    expect(await StockMovement.countDocuments({ variantId: first._id || first.id })).toBe(1)
  })

  it('rolls back variant create when stone payload is invalid', async () => {
    await expect(catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'AGG-BAD',
      label: '16',
      purity: '22k',
      weight_grams: 5,
      effective_weight: 5,
      stock_qty: 2,
      stock_idempotency_key: 'create-variant-bad-stones:stock',
      idempotency_key: 'create-variant-bad-stones',
      product_stones: [{ stone_count: 1 }],
    }, staff.id)).rejects.toBeTruthy()

    expect(await Variant.countDocuments({ sku: 'AGG-BAD' })).toBe(0)
    expect(await ProductStone.countDocuments()).toBe(0)
    expect(await StockMovement.countDocuments()).toBe(0)
  })

  it('updates stones only after validation and sets stock via ledger', async () => {
    const created = await catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'AGG-2',
      label: '18',
      purity: '22k',
      weight_grams: 4,
      effective_weight: 4,
      stock_qty: 2,
      stock_idempotency_key: 'create-variant-agg-2:stock',
      idempotency_key: 'create-variant-agg-2',
      product_stones: [fixedStone('ruby', 1)],
    }, staff.id)

    const updated = await catalogService.updateVariantComplete(created._id || created.id, {
      label: '18-updated',
      stock_qty: 5,
      expected_stock_qty: 2,
      stock_idempotency_key: 'update-variant-agg-2:stock',
      idempotency_key: 'update-variant-agg-2',
      product_stones: [fixedStone('emerald', 3)],
    }, staff.id)

    expect(updated.label).toBe('18-updated')
    expect(updated.stockQty).toBe(5)
    expect(updated.product_stones).toHaveLength(1)
    expect(updated.product_stones[0].stoneType).toBe('emerald')
    expect(await StockMovement.countDocuments({ variantId: created._id || created.id })).toBe(2)
  })

  it('rejects stock update on expected_stock conflict', async () => {
    const created = await catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'AGG-3',
      label: '20',
      purity: '22k',
      weight_grams: 3,
      effective_weight: 3,
      stock_qty: 1,
      stock_idempotency_key: 'create-variant-agg-3:stock',
      idempotency_key: 'create-variant-agg-3',
    }, staff.id)

    await expect(catalogService.updateVariantComplete(created._id || created.id, {
      stock_qty: 9,
      expected_stock_qty: 99,
      stock_idempotency_key: 'update-conflict-1:stock',
      idempotency_key: 'update-conflict-1',
    }, staff.id)).rejects.toMatchObject({ code: 'VARIANT_VERSION_CONFLICT' })
  })

  it('generic variant/stone POST is blocked', async () => {
    await expect(catalogService.create('variants', {
      product_id: product.id,
      sku: 'GENERIC-V',
      weight_grams: 2,
      effective_weight: 2,
    })).rejects.toMatchObject({ code: 'USE_VARIANT_AGGREGATE' })
    await expect(catalogService.create('stones', {
      variant_id: new mongoose.Types.ObjectId().toString(),
      stone_type: 'x',
    })).rejects.toMatchObject({ code: 'USE_VARIANT_AGGREGATE' })
  })
})

describe('primary image atomic set', () => {
  it('leaves exactly one primary under concurrent set-primary', async () => {
    const images = await ProductImage.create([
      { productId: product.id, imageUrl: 'https://cdn.example.com/a.jpg', isPrimary: true, displayOrder: 0 },
      { productId: product.id, imageUrl: 'https://cdn.example.com/b.jpg', isPrimary: false, displayOrder: 1 },
      { productId: product.id, imageUrl: 'https://cdn.example.com/c.jpg', isPrimary: false, displayOrder: 2 },
    ])

    await Promise.all([
      catalogService.setPrimaryImage(images[1].id),
      catalogService.setPrimaryImage(images[2].id),
      catalogService.setPrimaryImage(images[0].id),
    ])

    const primaryCount = await ProductImage.countDocuments({ productId: product.id, isPrimary: true })
    expect(primaryCount).toBe(1)
  })
})

describe('hydrated product pagination', () => {
  it('reaches product 201+ via page/limit', async () => {
    const docs = Array.from({ length: 210 }, (_, i) => ({
      name: `P${i + 1}`,
      slug: `p-${i + 1}`,
      brandId: product.brandId,
      categoryId: product.categoryId,
      status: 'active',
      metalType: 'gold',
      purity: '22k',
      displayOrder: i + 1,
    }))
    await Product.insertMany(docs)

    const page = await catalogService.list('products', { page: 5, limit: 50, hydrate: '1' }, true)
    expect(page.total).toBeGreaterThanOrEqual(211)
    expect(page.pages).toBeGreaterThanOrEqual(5)
    expect(page.items.length).toBeGreaterThan(0)
    expect(page.items.some((row) => {
      const n = Number(String(row.slug || '').replace(/^p-/, ''))
      return n >= 201
    })).toBe(true)
  })

  it('search finds a product outside page 1 before skip/limit', async () => {
    const fillers = Array.from({ length: 30 }, (_, i) => ({
      name: `FillerSearch${i}`,
      slug: `filler-search-${i}`,
      brandId: product.brandId,
      categoryId: product.categoryId,
      status: 'active',
      metalType: 'gold',
      purity: '22k',
      displayOrder: i,
    }))
    await Product.insertMany(fillers)
    await Product.create({
      name: 'NeedleSearchUniqueZed',
      slug: 'needle-search-unique-zed',
      brandId: product.brandId,
      categoryId: product.categoryId,
      status: 'active',
      metalType: 'gold',
      purity: '22k',
      displayOrder: 9999,
    })

    const page1 = await catalogService.list('products', { page: 1, limit: 10 }, true)
    expect(page1.items.some((row) => row.slug === 'needle-search-unique-zed')).toBe(false)

    const found = await catalogService.list('products', {
      page: 1,
      limit: 10,
      search: 'NeedleSearchUniqueZed',
    }, true)
    expect(found.total).toBeGreaterThanOrEqual(1)
    expect(found.items.some((row) => row.slug === 'needle-search-unique-zed')).toBe(true)
  })
})
