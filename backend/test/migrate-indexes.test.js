import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Customer, Staff, OtpCode, RefreshSession } from '../src/models/auth.models.js'
import {
  StoreSetting, TaxSetting, Category, Brand, Product, Variant, ProductImage, CmsPage,
} from '../src/models/catalog.models.js'
import {
  CartItem, WishlistItem, Coupon, Order, WalletAccount, WalletTransaction,
  CouponCustomerUsage, CouponRedemption, PaymentEvent, ReturnRequest, Review,
} from '../src/models/commerce.models.js'
import { GoldRate, StoneRate, StockMovement } from '../src/models/rate.models.js'
import { PendingUpload } from '../src/models/upload.models.js'
import { Counter } from '../src/models/audit.models.js'
import { Scheme, SchemeEnrollment, SchemePaymentReference } from '../src/models/scheme.models.js'
import { INDEX_SPECS, findMatchingIndex, findConflictingIndex, indexMatchesSpec, keysEqual } from '../scripts/migrate-indexes.js'

describe('migrate-indexes comparison helpers', () => {
  it('exports a non-empty INDEX_SPECS', () => {
    expect(INDEX_SPECS.length).toBeGreaterThan(20)
    expect(INDEX_SPECS.every((s) => s.collection && s.keys && s.options?.name)).toBe(true)
  })

  it('keysEqual distinguishes index key order', () => {
    expect(keysEqual({ a: 1, b: 1 }, { a: 1, b: 1 })).toBe(true)
    expect(keysEqual({ a: 1, b: 1 }, { b: 1, a: 1 })).toBe(false)
  })

  it('flags wrong keys with the same name as a conflict', () => {
    const spec = {
      keys: { customerId: 1, variantId: 1, customizationKey: 1 },
      options: { name: 'cartitems_customer_variant_customization_unique', unique: true },
    }
    const indexes = [
      {
        name: 'cartitems_customer_variant_customization_unique',
        key: { variantId: 1, customerId: 1, customizationKey: 1 },
        unique: true,
      },
    ]
    expect(indexMatchesSpec(indexes[0], spec)).toBe(false)
    expect(findMatchingIndex(indexes, spec)).toBeUndefined()
    expect(findConflictingIndex(indexes, spec)?.name).toBe('cartitems_customer_variant_customization_unique')
  })

  it('flags wrong unique option with the same name as a conflict', () => {
    const spec = {
      keys: { tokenHash: 1 },
      options: { name: 'refreshsessions_tokenHash_unique', unique: true },
    }
    const indexes = [
      { name: 'refreshsessions_tokenHash_unique', key: { tokenHash: 1 }, unique: false },
    ]
    expect(indexMatchesSpec(indexes[0], spec)).toBe(false)
    expect(findConflictingIndex(indexes, spec)?.name).toBe('refreshsessions_tokenHash_unique')
  })
})

describe('migrate-indexes manifest vs synced schemas', () => {
  let mongoServer

  const MODELS = [
    Customer, Staff, OtpCode, RefreshSession,
    StoreSetting, TaxSetting, Category, Brand, Product, Variant, ProductImage, CmsPage,
    CartItem, WishlistItem, Coupon, Order, WalletAccount, WalletTransaction,
    CouponCustomerUsage, CouponRedemption, PaymentEvent, ReturnRequest, Review,
    GoldRate, StoneRate, StockMovement, PendingUpload, Counter,
    Scheme, SchemeEnrollment, SchemePaymentReference,
  ]

  beforeAll(async () => {
    mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
    await mongoose.connect(mongoServer.getUri('goldex-migrate-indexes'))
    await Promise.all(MODELS.map((m) => m.syncIndexes()))
  }, 120_000)

  afterAll(async () => {
    await mongoose.disconnect()
    if (mongoServer) await mongoServer.stop()
  })

  it('every INDEX_SPECS entry matches a synced schema index on the test DB', async () => {
    const db = mongoose.connection.db
    const missing = []

    for (const spec of INDEX_SPECS) {
      const coll = db.collection(spec.collection)
      let indexes
      try {
        indexes = await coll.indexes()
      } catch (error) {
        missing.push({ name: spec.options.name, reason: `collection missing: ${error.message}` })
        continue
      }
      const match = findMatchingIndex(indexes, spec)
      if (!match) {
        missing.push({
          name: spec.options.name,
          collection: spec.collection,
          expectedKeys: spec.keys,
          actual: indexes.map((idx) => ({
            name: idx.name,
            key: idx.key,
            unique: idx.unique,
            sparse: idx.sparse,
            expireAfterSeconds: idx.expireAfterSeconds,
            partialFilterExpression: idx.partialFilterExpression,
          })),
        })
      }
    }

    expect(missing).toEqual([])
  })
})
