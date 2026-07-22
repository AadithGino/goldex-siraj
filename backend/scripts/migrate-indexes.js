/**
 * Create required production indexes without syncIndexes (does not drop unknown indexes).
 *
 * Before unique indexes: detects duplicates, reports them, and aborts create (nonzero exit).
 * There is no --force-duplicates bypass — reconcile data first.
 *
 * Usage:
 *   node scripts/migrate-indexes.js --dry-run
 *   node scripts/migrate-indexes.js
 *
 * Do NOT run apply against production from automation without an ops window.
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'

const dryRun = process.argv.includes('--dry-run')

/**
 * Critical production indexes mirrored from schemas / remediation requirements.
 * Names are stable for ops (create / drop / readiness checks).
 */
export const INDEX_SPECS = [
  // Auth / OTP / sessions
  {
    collection: 'otpcodes',
    keys: { activeChallengeKey: 1 },
    options: {
      unique: true,
      name: 'otpcodes_activeChallengeKey_unique',
      partialFilterExpression: { activeChallengeKey: { $type: 'string' } },
    },
    duplicateCheck: {
      collection: 'otpcodes',
      match: { activeChallengeKey: { $type: 'string' } },
      group: { activeChallengeKey: '$activeChallengeKey' },
    },
  },
  {
    collection: 'otpcodes',
    keys: { expiresAt: 1 },
    options: { expireAfterSeconds: 0, name: 'otpcodes_expiresAt_ttl' },
  },
  {
    collection: 'refreshsessions',
    keys: { tokenHash: 1 },
    options: { unique: true, name: 'refreshsessions_tokenHash_unique' },
    duplicateCheck: {
      collection: 'refreshsessions',
      group: { tokenHash: '$tokenHash' },
    },
  },
  {
    collection: 'refreshsessions',
    keys: { expiresAt: 1 },
    options: { expireAfterSeconds: 0, name: 'refreshsessions_expiresAt_ttl' },
  },
  {
    collection: 'customers',
    keys: { phone: 1 },
    options: { unique: true, sparse: true, name: 'customers_phone_unique' },
    duplicateCheck: {
      collection: 'customers',
      match: { phone: { $type: 'string' } },
      group: { phone: '$phone' },
    },
  },
  {
    collection: 'staffs',
    keys: { email: 1 },
    options: { unique: true, name: 'staffs_email_unique' },
    duplicateCheck: {
      collection: 'staffs',
      group: { email: '$email' },
    },
  },

  // Uploads
  {
    collection: 'pendinguploads',
    keys: { key: 1 },
    options: { unique: true, name: 'pendinguploads_key_unique' },
    duplicateCheck: {
      collection: 'pendinguploads',
      group: { key: '$key' },
    },
  },
  {
    collection: 'pendinguploads',
    keys: { expiresAt: 1 },
    options: { name: 'pendinguploads_expiresAt' },
  },

  // Inventory / rates
  {
    collection: 'stockmovements',
    keys: { idempotencyKey: 1 },
    options: {
      unique: true,
      sparse: false,
      name: 'stockmovements_idempotency_unique',
      partialFilterExpression: { idempotencyKey: { $type: 'string' } },
    },
    duplicateCheck: {
      collection: 'stockmovements',
      match: { idempotencyKey: { $type: 'string' } },
      group: { idempotencyKey: '$idempotencyKey' },
    },
  },
  {
    collection: 'stockmovements',
    keys: { variantId: 1 },
    options: { name: 'stockmovements_variantId' },
  },
  {
    collection: 'goldrates',
    keys: { purity: 1, isCurrent: 1 },
    options: {
      unique: true,
      name: 'goldrates_current_unique',
      partialFilterExpression: { isCurrent: true },
    },
    duplicateCheck: {
      collection: 'goldrates',
      match: { isCurrent: true },
      group: { purity: '$purity' },
    },
  },
  {
    collection: 'stonerates',
    keys: { stoneType: 1, grade: 1, unit: 1, isCurrent: 1 },
    options: {
      unique: true,
      name: 'stonerates_current_unique',
      partialFilterExpression: { isCurrent: true },
    },
    duplicateCheck: {
      collection: 'stonerates',
      match: { isCurrent: true },
      group: { stoneType: '$stoneType', grade: '$grade', unit: '$unit' },
    },
  },

  // Cart / wishlist
  // Legacy unique on {customerId, variantId} is superseded by customization-aware uniqueness.
  // migrate-indexes will flag/drop the old named index when definitions conflict.
  {
    collection: 'cartitems',
    keys: { customerId: 1, variantId: 1, customizationKey: 1 },
    options: { unique: true, name: 'cartitems_customer_variant_customization_unique' },
    duplicateCheck: {
      collection: 'cartitems',
      group: { customerId: '$customerId', variantId: '$variantId', customizationKey: '$customizationKey' },
    },
    dropIndexes: ['cartitems_customer_variant_unique'],
  },
  {
    collection: 'wishlistitems',
    keys: { customerId: 1, productId: 1 },
    options: { unique: true, name: 'wishlistitems_customer_product_unique' },
    duplicateCheck: {
      collection: 'wishlistitems',
      group: { customerId: '$customerId', productId: '$productId' },
    },
  },

  // Orders / payments
  {
    collection: 'orders',
    keys: { orderNumber: 1 },
    options: { unique: true, name: 'orders_orderNumber_unique' },
    duplicateCheck: {
      collection: 'orders',
      group: { orderNumber: '$orderNumber' },
    },
  },
  {
    collection: 'orders',
    keys: { invoiceNumber: 1 },
    options: { unique: true, sparse: true, name: 'orders_invoiceNumber_unique' },
    duplicateCheck: {
      collection: 'orders',
      match: { invoiceNumber: { $type: 'string' } },
      group: { invoiceNumber: '$invoiceNumber' },
    },
  },
  {
    collection: 'orders',
    keys: { customerId: 1, idempotencyKey: 1 },
    options: { unique: true, name: 'orders_customer_idempotency_unique' },
    duplicateCheck: {
      collection: 'orders',
      group: { customerId: '$customerId', idempotencyKey: '$idempotencyKey' },
    },
  },
  {
    collection: 'paymentevents',
    keys: { transactionId: 1 },
    options: { unique: true, sparse: true, name: 'paymentevents_transactionId_unique' },
    duplicateCheck: {
      collection: 'paymentevents',
      match: { transactionId: { $type: 'string' } },
      group: { transactionId: '$transactionId' },
    },
  },

  // Schemes — one active enrollment per customer+scheme
  {
    collection: 'schemeenrollments',
    keys: { customerId: 1, schemeId: 1 },
    options: {
      unique: true,
      name: 'schemeenrollments_active_customer_scheme_unique',
      partialFilterExpression: { status: 'active' },
    },
    duplicateCheck: {
      collection: 'schemeenrollments',
      match: { status: 'active' },
      group: { customerId: '$customerId', schemeId: '$schemeId' },
    },
  },

  // Scheme bank/card transaction-ref uniqueness (not PaymentEvent locks)
  {
    collection: 'schemepaymentreferences',
    keys: { normalizedReference: 1 },
    options: { unique: true, name: 'schemepaymentreferences_normalizedReference_unique' },
    duplicateCheck: {
      collection: 'schemepaymentreferences',
      group: { normalizedReference: '$normalizedReference' },
    },
  },

  // Coupons
  {
    collection: 'coupons',
    keys: { code: 1 },
    options: { unique: true, name: 'coupons_code_unique' },
    duplicateCheck: {
      collection: 'coupons',
      group: { code: '$code' },
    },
  },
  {
    collection: 'couponcustomerusages',
    keys: { couponId: 1, customerId: 1 },
    options: { unique: true, name: 'couponcustomerusages_coupon_customer_unique' },
    duplicateCheck: {
      collection: 'couponcustomerusages',
      group: { couponId: '$couponId', customerId: '$customerId' },
    },
  },
  {
    collection: 'couponredemptions',
    keys: { couponId: 1, orderId: 1 },
    options: { unique: true, name: 'couponredemptions_coupon_order_unique' },
    duplicateCheck: {
      collection: 'couponredemptions',
      group: { couponId: '$couponId', orderId: '$orderId' },
    },
  },

  // Wallet
  {
    collection: 'walletaccounts',
    keys: { customerId: 1 },
    options: { unique: true, name: 'walletaccounts_customerId_unique' },
    duplicateCheck: { collection: 'walletaccounts', group: { customerId: '$customerId' } },
  },
  {
    collection: 'wallettransactions',
    keys: { idempotencyKey: 1 },
    options: { unique: true, sparse: true, name: 'wallettransactions_idempotencyKey_unique' },
    duplicateCheck: {
      collection: 'wallettransactions',
      group: { idempotencyKey: '$idempotencyKey' },
      match: { idempotencyKey: { $type: 'string' } },
    },
  },

  // Returns / reviews
  {
    collection: 'returnrequests',
    keys: { orderId: 1, orderItemId: 1, status: 1 },
    options: { name: 'returnrequests_order_item_status' },
  },
  {
    collection: 'returnrequests',
    keys: { orderId: 1 },
    options: {
      unique: true,
      name: 'returnrequests_active_cancellation_unique',
      partialFilterExpression: {
        kind: 'cancellation',
        status: { $in: ['requested', 'approved'] },
      },
    },
    duplicateCheck: {
      collection: 'returnrequests',
      match: { kind: 'cancellation', status: { $in: ['requested', 'approved'] } },
      group: { orderId: '$orderId' },
    },
  },
  {
    collection: 'returnrequests',
    keys: { orderId: 1 },
    options: {
      unique: true,
      name: 'returnrequests_active_whole_order_return_unique',
      partialFilterExpression: {
        kind: 'return',
        orderItemId: null,
        status: { $in: ['requested', 'approved'] },
      },
    },
    duplicateCheck: {
      collection: 'returnrequests',
      match: {
        kind: 'return',
        orderItemId: null,
        status: { $in: ['requested', 'approved'] },
      },
      group: { orderId: '$orderId' },
    },
  },
  {
    collection: 'returncoordinations',
    keys: { orderId: 1 },
    options: { unique: true, name: 'returncoordination_orderId_unique' },
    duplicateCheck: {
      collection: 'returncoordinations',
      group: { orderId: '$orderId' },
    },
  },
  {
    collection: 'reviews',
    keys: { productId: 1, customerId: 1 },
    options: { unique: true, name: 'reviews_product_customer_unique' },
    duplicateCheck: {
      collection: 'reviews',
      group: { productId: '$productId', customerId: '$customerId' },
    },
  },

  // Catalog slugs / SKU / CMS
  {
    collection: 'categories',
    keys: { slug: 1 },
    options: { unique: true, name: 'categories_slug_unique' },
    duplicateCheck: { collection: 'categories', group: { slug: '$slug' } },
  },
  {
    collection: 'brands',
    keys: { slug: 1 },
    options: { unique: true, name: 'brands_slug_unique' },
    duplicateCheck: { collection: 'brands', group: { slug: '$slug' } },
  },
  {
    collection: 'products',
    keys: { slug: 1 },
    options: { unique: true, name: 'products_slug_unique' },
    duplicateCheck: { collection: 'products', group: { slug: '$slug' } },
  },
  {
    collection: 'variants',
    keys: { sku: 1 },
    options: { unique: true, sparse: true, name: 'variants_sku_unique' },
    duplicateCheck: {
      collection: 'variants',
      match: { sku: { $type: 'string' } },
      group: { sku: '$sku' },
    },
  },
  {
    collection: 'variants',
    keys: { 'metadata.idempotencyKey': 1 },
    options: {
      unique: true,
      sparse: false,
      name: 'variants_metadata_idempotencyKey_unique',
      partialFilterExpression: { 'metadata.idempotencyKey': { $type: 'string' } },
    },
    duplicateCheck: {
      collection: 'variants',
      match: { 'metadata.idempotencyKey': { $type: 'string' } },
      group: { metadataIdempotencyKey: '$metadata.idempotencyKey' },
    },
  },
  {
    collection: 'cmspages',
    keys: { slug: 1 },
    options: { unique: true, name: 'cmspages_slug_unique' },
    duplicateCheck: { collection: 'cmspages', group: { slug: '$slug' } },
  },

  // Counters / settings singletons / primary image
  {
    collection: 'counters',
    keys: { key: 1 },
    options: { unique: true, name: 'counters_key_unique' },
    duplicateCheck: { collection: 'counters', group: { key: '$key' } },
  },
  {
    collection: 'storesettings',
    keys: { singleton: 1 },
    options: { unique: true, name: 'storesettings_singleton_unique' },
    duplicateCheck: { collection: 'storesettings', group: { singleton: '$singleton' } },
  },
  {
    collection: 'taxsettings',
    keys: { singleton: 1 },
    options: { unique: true, name: 'taxsettings_singleton_unique' },
    duplicateCheck: { collection: 'taxsettings', group: { singleton: '$singleton' } },
  },
  {
    collection: 'productimages',
    keys: { productId: 1 },
    options: {
      unique: true,
      name: 'productimages_primary_unique',
      partialFilterExpression: { isPrimary: true },
    },
    duplicateCheck: {
      collection: 'productimages',
      match: { isPrimary: true },
      group: { productId: '$productId' },
    },
  },
]

export async function findDuplicates(db, spec) {
  if (!spec.duplicateCheck) return []
  const coll = db.collection(spec.duplicateCheck.collection)
  const pipeline = []
  if (spec.duplicateCheck.match) pipeline.push({ $match: spec.duplicateCheck.match })
  pipeline.push(
    { $group: { _id: spec.duplicateCheck.group, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 50 },
  )
  return coll.aggregate(pipeline).toArray()
}

export async function indexExists(coll, name) {
  const existing = await coll.indexes()
  return existing.some((idx) => idx.name === name)
}

/** Compare index key documents (order-sensitive). */
export function keysEqual(a, b) {
  const ak = Object.keys(a || {})
  const bk = Object.keys(b || {})
  if (ak.length !== bk.length) return false
  return ak.every((k, i) => k === bk[i] && a[k] === b[k])
}

function partialFilterEqual(a, b) {
  return JSON.stringify(a || {}) === JSON.stringify(b || {})
}

/**
 * Strict comparison: key order, unique, sparse, partialFilterExpression, TTL expireAfterSeconds.
 */
export function indexMatchesSpec(idx, spec) {
  if (!keysEqual(idx.key, spec.keys)) return false
  if (Boolean(spec.options.unique) !== Boolean(idx.unique)) return false
  if (Boolean(spec.options.sparse) !== Boolean(idx.sparse)) return false
  if (spec.options.expireAfterSeconds !== undefined) {
    if (idx.expireAfterSeconds !== spec.options.expireAfterSeconds) return false
  } else if (idx.expireAfterSeconds != null) {
    return false
  }
  if (spec.options.partialFilterExpression) {
    if (!partialFilterEqual(idx.partialFilterExpression, spec.options.partialFilterExpression)) return false
  } else if (idx.partialFilterExpression && Object.keys(idx.partialFilterExpression).length > 0) {
    return false
  }
  return true
}

/**
 * Find a synced/mongoose index that matches a manifest spec by keys + critical options.
 */
export function findMatchingIndex(indexes, spec) {
  return indexes.find((idx) => indexMatchesSpec(idx, spec))
}

/**
 * Same name as manifest but wrong definition → conflict (must not be treated as skip).
 */
export function findConflictingIndex(indexes, spec) {
  const byName = indexes.find((idx) => idx.name === spec.options.name)
  if (byName && !indexMatchesSpec(byName, spec)) return byName
  return null
}

export async function runIndexMigration({ db, dryRun: isDryRun = false } = {}) {
  let blocked = 0
  let created = 0
  let skipped = 0
  const blockers = []

  for (const spec of INDEX_SPECS) {
    const coll = db.collection(spec.collection)
    const dupes = await findDuplicates(db, spec)
    if (dupes.length) {
      blocked += 1
      blockers.push({ name: spec.options.name, duplicates: dupes })
      console.error(`DUPLICATES blocking ${spec.options.name}:`, JSON.stringify(dupes, null, 2))
      console.error('Aborting unique index create. Reconcile duplicates first.')
      continue
    }

    let indexes
    try {
      indexes = await coll.indexes()
    } catch {
      indexes = []
    }

    // Drop superseded named indexes (e.g. legacy cartitems_customer_variant_unique).
    for (const legacyName of spec.dropIndexes || []) {
      const legacy = indexes.find((idx) => idx.name === legacyName)
      if (!legacy) continue
      if (isDryRun) {
        console.log(`  would drop legacy: ${legacyName} on ${spec.collection}`)
      } else {
        await coll.dropIndex(legacyName)
        console.log(`  dropped legacy: ${legacyName}`)
        indexes = indexes.filter((idx) => idx.name !== legacyName)
      }
    }

    const conflict = findConflictingIndex(indexes, spec)
    if (conflict) {
      blocked += 1
      blockers.push({
        name: spec.options.name,
        reason: 'definition_mismatch',
        expected: { keys: spec.keys, options: spec.options },
        actual: {
          name: conflict.name,
          key: conflict.key,
          unique: conflict.unique,
          sparse: conflict.sparse,
          expireAfterSeconds: conflict.expireAfterSeconds,
          partialFilterExpression: conflict.partialFilterExpression,
        },
      })
      console.error(`CONFLICT ${spec.options.name}: existing index has a different definition`)
      continue
    }

    if (indexes.some((idx) => idx.name === spec.options.name) || findMatchingIndex(indexes, spec)) {
      console.log(`  exists: ${spec.options.name}`)
      skipped += 1
      continue
    }

    if (isDryRun) {
      console.log(`  would create: ${spec.options.name} on ${spec.collection}`, spec.keys)
      continue
    }

    await coll.createIndex(spec.keys, spec.options)
    console.log(`  created: ${spec.options.name}`)
    created += 1
  }

  return { created, skipped, blocked, blockers }
}

async function main() {
  await connectDatabase()
  const db = mongoose.connection.db
  console.log(`Index migration (${dryRun ? 'dry-run' : 'apply'})…`)

  const result = await runIndexMigration({ db, dryRun })
  console.log(`Done. created=${result.created} skipped=${result.skipped} duplicate_blocks=${result.blocked}`)
  if (result.blocked > 0) {
    process.exitCode = 2
  }
}

const isDirectRun = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (isDirectRun) {
  main()
    .then(() => disconnectDatabase())
    .catch(async (error) => {
      console.error(error)
      await disconnectDatabase().catch(() => null)
      process.exit(1)
    })
}
