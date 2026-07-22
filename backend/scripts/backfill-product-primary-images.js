/**
 * Reconcile ProductImage primary flags before applying productimages_primary_unique.
 *
 * Deterministic winner per product:
 * 1. Lowest displayOrder
 * 2. Then oldest createdAt
 * 3. Then lowest stable _id
 *
 * Default: dry-run (zero writes). Require explicit --apply.
 * Never deletes image records or remote storage objects.
 * Never changes image URLs or displayOrder.
 *
 * Usage (from backend workspace):
 *   npm run products:backfill-primary-images:dry
 *   npm run products:backfill-primary-images
 *
 * Safe order:
 *   npm run products:backfill-primary-images:dry
 *   npm run migrate:indexes:dry
 *   # after approval:
 *   npm run products:backfill-primary-images
 *   npm run migrate:indexes
 *
 * Exit codes:
 *   0 — success (dry-run or apply)
 *   1 — unexpected / transaction error
 */
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import {
  analyzePrimaryImageIssues,
  applyPrimaryImageReconciliation,
} from '../src/services/productPrimaryImage.reconciliation.js'

const apply = process.argv.includes('--apply')

async function main() {
  await connectDatabase()
  console.log(`Product primary-image reconciliation (${apply ? 'APPLY' : 'dry-run'})…`)
  if (apply) {
    console.log('NOTE: apply requires maintenance mode (pause catalog image primary edits).')
  }

  const report = await analyzePrimaryImageIssues()
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    ...report,
  }, null, 2))

  if (apply) {
    const result = await applyPrimaryImageReconciliation(report.products)
    console.log(JSON.stringify({ applied: result }, null, 2))
  } else {
    console.log(JSON.stringify({
      warning: 'Dry-run only — zero writes performed',
      proposed_updates: report.products.length,
    }, null, 2))
  }

  await disconnectDatabase()
  process.exit(0)
}

main().catch(async (error) => {
  console.error(error)
  try { await mongoose.disconnect() } catch { /* ignore */ }
  process.exit(1)
})
