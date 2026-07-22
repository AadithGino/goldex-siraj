/**
 * Read-only dry-run audit of ProductStone pricing configuration.
 *
 * Usage (from backend workspace):
 *   npm run stones:audit-pricing:dry
 *
 * Never modifies data.
 */
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { ProductStone, Variant } from '../src/models/catalog.models.js'
import { StoneRate } from '../src/models/rate.models.js'

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase()
}

function pushSample(bucket, id, limit = 25) {
  if (bucket.samples.length < limit) bucket.samples.push(String(id))
  bucket.count += 1
}

async function main() {
  await connectDatabase()
  console.log('ProductStone pricing audit (dry-run, read-only)…')

  const report = {
    mode: 'dry-run',
    missing_stone_rate_refs: { count: 0, samples: [] },
    type_grade_unit_mismatches: { count: 0, samples: [] },
    rate_mode_without_current_rate: { count: 0, samples: [] },
    fixed_or_manual_only: { count: 0, samples: [] },
    invalid_counts_or_weights: { count: 0, samples: [] },
    metadata_only_stone_groups: { count: 0, samples: [] },
    aggregate_and_metadata_conflict: { count: 0, samples: [] },
    active_variants_unquotable: { count: 0, samples: [] },
    totals: { product_stones: 0, variants_scanned: 0 },
  }

  const stones = await ProductStone.find({}).lean()
  report.totals.product_stones = stones.length
  const currentRates = await StoneRate.find({ isCurrent: true }).lean()

  for (const stone of stones) {
    const mode = stone.pricingMode === 'fixed'
      || (!stone.stoneRateId && stone.manualCharge != null)
      ? 'fixed'
      : 'rate'
    const unit = stone.unit === 'carat' ? 'carat' : 'piece'

    if (unit === 'carat') {
      if (!(Number(stone.weight) > 0)) pushSample(report.invalid_counts_or_weights, stone._id)
    } else if (!(Number(stone.stoneCount) >= 1) || !Number.isInteger(Number(stone.stoneCount))) {
      pushSample(report.invalid_counts_or_weights, stone._id)
    }

    if (mode === 'fixed') {
      pushSample(report.fixed_or_manual_only, stone._id)
      continue
    }

    if (stone.stoneRateId) {
      const ref = await StoneRate.findById(stone.stoneRateId).lean()
      if (!ref) {
        pushSample(report.missing_stone_rate_refs, stone._id)
      } else if (
        normalizeKey(ref.stoneType) !== normalizeKey(stone.stoneType)
        || normalizeKey(ref.grade || '') !== normalizeKey(stone.grade || '')
        || (ref.unit === 'carat' ? 'carat' : 'piece') !== unit
      ) {
        pushSample(report.type_grade_unit_mismatches, stone._id)
      }
    } else {
      pushSample(report.missing_stone_rate_refs, stone._id)
    }

    const match = currentRates.find((row) => (
      row.unit === unit
      && normalizeKey(row.stoneType) === normalizeKey(stone.stoneType)
      && normalizeKey(row.grade || '') === normalizeKey(stone.grade || '')
      && Number(row.rate) > 0
    ))
    if (!match) pushSample(report.rate_mode_without_current_rate, stone._id)
  }

  const variants = await Variant.find({}).select('_id isActive metadata').lean()
  report.totals.variants_scanned = variants.length
  for (const variant of variants) {
    const groups = variant.metadata?.stone_groups
    const hasMeta = Array.isArray(groups) && groups.length > 0
    const aggCount = await ProductStone.countDocuments({ variantId: variant._id })
    if (hasMeta && aggCount === 0) pushSample(report.metadata_only_stone_groups, variant._id)
    if (hasMeta && aggCount > 0) pushSample(report.aggregate_and_metadata_conflict, variant._id)
  }

  // Active variants with rate stones but no current rate (cannot quote)
  const active = await Variant.find({ isActive: true }).select('_id').lean()
  for (const variant of active) {
    const rows = await ProductStone.find({ variantId: variant._id }).lean()
    if (!rows.length) continue
    let unquotable = false
    for (const stone of rows) {
      const mode = stone.pricingMode === 'fixed'
        || (!stone.stoneRateId && stone.manualCharge != null)
        ? 'fixed'
        : 'rate'
      if (mode === 'fixed') {
        if (!(Number(stone.manualCharge) >= 0)) unquotable = true
        continue
      }
      const unit = stone.unit === 'carat' ? 'carat' : 'piece'
      const match = currentRates.find((row) => (
        row.unit === unit
        && normalizeKey(row.stoneType) === normalizeKey(stone.stoneType)
        && normalizeKey(row.grade || '') === normalizeKey(stone.grade || '')
        && Number(row.rate) > 0
      ))
      if (!match) unquotable = true
    }
    if (unquotable) pushSample(report.active_variants_unquotable, variant._id)
  }

  console.log(JSON.stringify(report, null, 2))
  await disconnectDatabase()
  process.exit(0)
}

main().catch(async (error) => {
  console.error(error)
  try { await mongoose.disconnect() } catch { /* ignore */ }
  process.exit(1)
})
