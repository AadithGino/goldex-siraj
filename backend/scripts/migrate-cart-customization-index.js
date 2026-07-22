/**
 * Backfill CartItem.customizationKey and migrate cart uniqueness index.
 *
 * Behaviour:
 * - Same variant + same customization → one cart line (qty merges)
 * - Same variant + different customization → separate cart lines
 * - No customization → customizationKey ''
 *
 * Usage (never against production without dry-run first):
 *   node scripts/migrate-cart-customization-index.js          # dry-run (default)
 *   node scripts/migrate-cart-customization-index.js --apply
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { CartItem } from '../src/models/commerce.models.js'
import { customizationKey } from '../src/utils/customization.js'

const apply = process.argv.includes('--apply')
const dryRun = !apply

export async function runCartCustomizationIndexMigration({ dryRun: isDryRun = true } = {}) {
  const totals = {
    mode: isDryRun ? 'dry-run' : 'apply',
    scanned: 0,
    missingKey: 0,
    wouldSet: 0,
    updated: 0,
    legacyIndexPresent: false,
    targetIndexPresent: false,
    exitCode: 0,
  }

  const db = CartItem.db
  const coll = db.collection('cartitems')
  let indexes = []
  try {
    indexes = await coll.indexes()
  } catch {
    indexes = []
  }
  totals.legacyIndexPresent = indexes.some((idx) => idx.name === 'cartitems_customer_variant_unique')
  totals.targetIndexPresent = indexes.some((idx) => idx.name === 'cartitems_customer_variant_customization_unique')

  const cursor = CartItem.find({}).select('_id customizationRequest customizationKey').cursor()
  for await (const row of cursor) {
    totals.scanned += 1
    const hasKey = row.customizationKey != null && typeof row.customizationKey === 'string'
    if (hasKey) continue
    totals.missingKey += 1
    totals.wouldSet += 1
    const key = customizationKey(row.customizationRequest ?? null)
    if (!isDryRun) {
      await CartItem.updateOne({ _id: row._id }, { $set: { customizationKey: key } })
      totals.updated += 1
    }
  }

  if (!isDryRun) {
    if (totals.legacyIndexPresent) {
      await coll.dropIndex('cartitems_customer_variant_unique')
      totals.legacyIndexDropped = true
    }
    if (!totals.targetIndexPresent) {
      await coll.createIndex(
        { customerId: 1, variantId: 1, customizationKey: 1 },
        { unique: true, name: 'cartitems_customer_variant_customization_unique' },
      )
      totals.targetIndexCreated = true
    }
  } else {
    totals.wouldDropLegacy = totals.legacyIndexPresent
    totals.wouldCreateTarget = !totals.targetIndexPresent
  }

  return totals
}

async function main() {
  let exitCode = 0
  try {
    await connectDatabase()
    const totals = await runCartCustomizationIndexMigration({ dryRun })
    console.log(JSON.stringify(totals, null, 2))
    exitCode = totals.exitCode || 0
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }))
    exitCode = 1
  } finally {
    try {
      await disconnectDatabase()
    } catch {
      // ignore
    }
  }
  process.exit(exitCode)
}

const isDirect = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isDirect) main()
