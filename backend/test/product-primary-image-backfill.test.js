/**
 * Phase 22.7A — primary-image reconciliation + migrate-indexes duplicate gate.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Brand, Category, Product, ProductImage } from '../src/models/catalog.models.js'
import {
  analyzePrimaryImageIssues,
  applyPrimaryImageReconciliation,
  pickPrimaryWinner,
} from '../src/services/productPrimaryImage.reconciliation.js'
import { INDEX_SPECS, runIndexMigration } from '../scripts/migrate-indexes.js'

let mongoServer

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-primary-image-backfill'))
  // Prevent mongoose from re-creating the unique primary index mid-suite while we seed duplicates.
  ProductImage.schema.set('autoIndex', false)
  try {
    await mongoose.connection.db.collection('productimages').dropIndex('productimages_primary_unique')
  } catch {
    /* may not exist */
  }
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})))
  await ProductImage.createCollection().catch(() => null)
  try {
    await mongoose.connection.db.collection('productimages').dropIndex('productimages_primary_unique')
  } catch {
    /* index may not exist */
  }
})

/** Seed images via native driver so we can insert duplicate primaries after dropping the unique index. */
async function insertImages(rows) {
  const coll = mongoose.connection.db.collection('productimages')
  const docs = rows.map((row) => ({
    productId: new mongoose.Types.ObjectId(String(row.productId)),
    imageUrl: row.imageUrl,
    displayOrder: row.displayOrder ?? 0,
    isPrimary: row.isPrimary === true,
    altText: row.altText ?? null,
    createdAt: row.createdAt || new Date(),
    updatedAt: row.updatedAt || new Date(),
  }))
  const result = await coll.insertMany(docs)
  return Object.values(result.insertedIds).map((id, i) => ({ _id: id, ...docs[i] }))
}

async function seedProduct(slug) {
  const category = await Category.create({ name: 'C', slug: `c-${slug}`, isActive: true })
  const brand = await Brand.create({ name: 'B', slug: `b-${slug}`, isActive: true })
  return Product.create({
    name: 'Ring',
    slug,
    categoryId: category.id,
    brandId: brand.id,
    status: 'active',
    metalType: 'gold',
    purity: '22k',
    taxTreatment: 'standard',
  })
}

describe('pickPrimaryWinner', () => {
  it('prefers lowest displayOrder, then oldest createdAt, then lowest _id', () => {
    const a = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', displayOrder: 2, createdAt: new Date('2026-01-01') }
    const b = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', displayOrder: 1, createdAt: new Date('2026-02-01') }
    const c = { _id: 'cccccccccccccccccccccccc', displayOrder: 1, createdAt: new Date('2026-01-01') }
    expect(String(pickPrimaryWinner([a, b, c])._id)).toBe(String(c._id))
  })
})

describe('primary-image reconciliation', () => {
  it('two existing primaries select one deterministic winner', async () => {
    const product = await seedProduct('dup-primary')
    const [older, newer] = await insertImages([
      {
        productId: product.id,
        imageUrl: 'https://cdn.example.com/a.jpg',
        displayOrder: 1,
        isPrimary: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        productId: product.id,
        imageUrl: 'https://cdn.example.com/b.jpg',
        displayOrder: 0,
        isPrimary: true,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    ])

    const report = await analyzePrimaryImageIssues()
    expect(report.totals.duplicate_primary_products).toBe(1)
    expect(report.products).toHaveLength(1)
    expect(report.products[0].product_id).toBe(String(product.id))
    expect(report.products[0].current_primary_ids.sort()).toEqual(
      [String(older._id), String(newer._id)].sort(),
    )
    expect(report.products[0].winner_image_id).toBe(String(newer._id))

    await applyPrimaryImageReconciliation(report.products)
    const rows = await ProductImage.find({ productId: product.id }).lean()
    expect(rows.filter((r) => r.isPrimary)).toHaveLength(1)
    expect(String(rows.find((r) => r.isPrimary)._id)).toBe(String(newer._id))
    expect(rows).toHaveLength(2)
  })

  it('zero primary promotes deterministic winner', async () => {
    const product = await seedProduct('no-primary')
    const [, second] = await insertImages([
      {
        productId: product.id,
        imageUrl: 'https://cdn.example.com/a.jpg',
        displayOrder: 5,
        isPrimary: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        productId: product.id,
        imageUrl: 'https://cdn.example.com/b.jpg',
        displayOrder: 1,
        isPrimary: false,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    ])

    const report = await analyzePrimaryImageIssues()
    expect(report.totals.missing_primary_products).toBe(1)
    expect(report.products[0].winner_image_id).toBe(String(second._id))

    await applyPrimaryImageReconciliation(report.products)
    const primary = await ProductImage.findOne({ productId: product.id, isPrimary: true })
    expect(String(primary._id)).toBe(String(second._id))
    expect(await ProductImage.countDocuments({ productId: product.id })).toBe(2)
  })

  it('already-correct product remains unchanged', async () => {
    const product = await seedProduct('ok-primary')
    const [primary] = await insertImages([
      {
        productId: product.id,
        imageUrl: 'https://cdn.example.com/a.jpg',
        displayOrder: 2,
        isPrimary: true,
      },
      {
        productId: product.id,
        imageUrl: 'https://cdn.example.com/b.jpg',
        displayOrder: 0,
        isPrimary: false,
      },
    ])

    const before = await ProductImage.find({ productId: product.id }).lean()
    const report = await analyzePrimaryImageIssues()
    expect(report.products.find((p) => p.product_id === String(product.id))).toBeUndefined()
    expect(report.totals.already_correct).toBeGreaterThanOrEqual(1)

    await applyPrimaryImageReconciliation(report.products)
    const after = await ProductImage.find({ productId: product.id }).lean()
    expect(after.map((r) => ({ id: String(r._id), isPrimary: r.isPrimary })).sort((a, b) => a.id.localeCompare(b.id)))
      .toEqual(before.map((r) => ({ id: String(r._id), isPrimary: r.isPrimary })).sort((a, b) => a.id.localeCompare(b.id)))
    expect(String(after.find((r) => r.isPrimary)._id)).toBe(String(primary._id))
  })

  it('repeated apply is idempotent and never deletes images', async () => {
    const product = await seedProduct('idem')
    await insertImages([
      {
        productId: product.id,
        imageUrl: 'https://cdn.example.com/a.jpg',
        displayOrder: 1,
        isPrimary: true,
      },
      {
        productId: product.id,
        imageUrl: 'https://cdn.example.com/b.jpg',
        displayOrder: 0,
        isPrimary: true,
      },
    ])

    const report1 = await analyzePrimaryImageIssues()
    await applyPrimaryImageReconciliation(report1.products)
    const mid = await ProductImage.countDocuments({ productId: product.id })
    const report2 = await analyzePrimaryImageIssues()
    expect(report2.products).toHaveLength(0)
    await applyPrimaryImageReconciliation(report2.products)
    expect(await ProductImage.countDocuments({ productId: product.id })).toBe(mid)
    expect(await ProductImage.countDocuments({ productId: product.id, isPrimary: true })).toBe(1)
  })

  it('dry-run path (analyze only) performs zero writes', async () => {
    const product = await seedProduct('dry')
    await insertImages([
      {
        productId: product.id,
        imageUrl: 'https://cdn.example.com/a.jpg',
        displayOrder: 0,
        isPrimary: true,
      },
      {
        productId: product.id,
        imageUrl: 'https://cdn.example.com/b.jpg',
        displayOrder: 1,
        isPrimary: true,
      },
    ])
    const before = await ProductImage.find({ productId: product.id }).lean()
    await analyzePrimaryImageIssues()
    const after = await ProductImage.find({ productId: product.id }).lean()
    expect(after.map((r) => `${r._id}:${r.isPrimary}`).sort())
      .toEqual(before.map((r) => `${r._id}:${r.isPrimary}`).sort())
  })
})

describe('migrate-indexes primary unique after reconciliation', () => {
  const primarySpec = INDEX_SPECS.find((s) => s.options.name === 'productimages_primary_unique')

  it('dry-run reports duplicate blockers before reconciliation', async () => {
    const product = await seedProduct('migrate-block')
    await insertImages([
      {
        productId: product.id,
        imageUrl: 'https://cdn.example.com/a.jpg',
        displayOrder: 0,
        isPrimary: true,
      },
      {
        productId: product.id,
        imageUrl: 'https://cdn.example.com/b.jpg',
        displayOrder: 1,
        isPrimary: true,
      },
    ])

    await mongoose.connection.db.collection('productimages').dropIndexes().catch(() => null)
    await mongoose.connection.db.collection('productimages').createIndex({ productId: 1 }, { name: 'productId_1' })

    const result = await runIndexMigration({
      db: mongoose.connection.db,
      dryRun: true,
    })
    const blocker = result.blockers.find((b) => b.name === 'productimages_primary_unique')
    expect(blocker).toBeTruthy()
    expect(blocker.duplicates.length).toBeGreaterThan(0)
    expect(result.blocked).toBeGreaterThan(0)
  })

  it('migration succeeds in test DB after reconciliation', async () => {
    const product = await seedProduct('migrate-ok')
    await insertImages([
      {
        productId: product.id,
        imageUrl: 'https://cdn.example.com/a.jpg',
        displayOrder: 0,
        isPrimary: true,
      },
      {
        productId: product.id,
        imageUrl: 'https://cdn.example.com/b.jpg',
        displayOrder: 1,
        isPrimary: true,
      },
    ])

    const report = await analyzePrimaryImageIssues()
    await applyPrimaryImageReconciliation(report.products)

    await mongoose.connection.db.collection('productimages').dropIndexes().catch(() => null)
    await mongoose.connection.db.collection('productimages').createIndex({ productId: 1 }, { name: 'productId_1' })

    const result = await runIndexMigration({
      db: mongoose.connection.db,
      dryRun: false,
    })
    const primaryBlock = result.blockers.find((b) => b.name === primarySpec.options.name)
    expect(primaryBlock).toBeUndefined()

    const indexes = await mongoose.connection.db.collection('productimages').indexes()
    const created = indexes.find((idx) => idx.name === 'productimages_primary_unique')
    expect(created).toBeTruthy()
    expect(created.unique).toBe(true)
  })
})
