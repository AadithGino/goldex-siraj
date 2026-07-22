/**
 * Backfill CouponCustomerUsage from active CouponRedemption records.
 * Also reconciles Coupon.usedCount.
 *
 * MAINTENANCE MODE REQUIRED for apply:
 * Pause checkout, coupon redeem, and order-cancel coupon rollback traffic before apply.
 * Dry-run may run anytime for reporting.
 *
 * Usage:
 *   node scripts/backfill-coupon-customer-usage.js --dry-run
 *   node scripts/backfill-coupon-customer-usage.js
 *
 * Exit codes:
 *   0 — no remaining mismatches after the run (dry-run: projected clean; apply: written clean)
 *   2 — mismatches remain (dry-run reports drift; apply failed to clear all)
 *   1 — unexpected error
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { Coupon, CouponCustomerUsage, CouponRedemption } from '../src/models/commerce.models.js'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  await connectDatabase()
  console.log(`Backfill CouponCustomerUsage (${dryRun ? 'dry-run' : 'apply'})…`)
  if (!dryRun) {
    console.log('NOTE: apply requires maintenance mode (no concurrent coupon redeem/rollback).')
  }

  const before = {
    usageRows: await CouponCustomerUsage.countDocuments(),
    activeRedemptions: await CouponRedemption.countDocuments({ status: { $ne: 'rolled_back' } }),
    coupons: await Coupon.countDocuments(),
  }

  const active = await CouponRedemption.aggregate([
    { $match: { status: { $ne: 'rolled_back' } } },
    {
      $group: {
        _id: { couponId: '$couponId', customerId: '$customerId' },
        activeCount: { $sum: 1 },
      },
    },
  ])

  let upserts = 0
  let mismatchesBefore = 0
  let mismatchesAfter = 0

  for (const row of active) {
    const { couponId, customerId } = row._id
    const desired = row.activeCount
    const existing = await CouponCustomerUsage.findOne({ couponId, customerId }).lean()
    const current = existing ? Number(existing.activeCount || 0) : null
    if (current === desired) continue
    mismatchesBefore += 1
    console.log(`  coupon=${couponId} customer=${customerId}: usage=${current ?? 'missing'} → ${desired}`)
    if (!dryRun) {
      await CouponCustomerUsage.findOneAndUpdate(
        { couponId, customerId },
        { $set: { activeCount: desired }, $setOnInsert: { couponId, customerId } },
        { upsert: true },
      )
      upserts += 1
    }
  }

  // Zero out / fix usage rows with no matching active redemptions
  const stale = await CouponCustomerUsage.find().lean()
  for (const row of stale) {
    const count = await CouponRedemption.countDocuments({
      couponId: row.couponId,
      customerId: row.customerId,
      status: { $ne: 'rolled_back' },
    })
    if (count === Number(row.activeCount || 0)) continue
    mismatchesBefore += 1
    console.log(`  stale usage coupon=${row.couponId} customer=${row.customerId}: ${row.activeCount} → ${count}`)
    if (!dryRun) {
      await CouponCustomerUsage.updateOne({ _id: row._id }, { $set: { activeCount: count } })
      upserts += 1
    }
  }

  // Reconcile Coupon.usedCount
  const coupons = await Coupon.find().select('_id code usedCount').lean()
  let couponFixed = 0
  for (const coupon of coupons) {
    const activeCount = await CouponRedemption.countDocuments({
      couponId: coupon._id,
      status: { $ne: 'rolled_back' },
    })
    if (Number(coupon.usedCount || 0) === activeCount) continue
    mismatchesBefore += 1
    console.log(`  coupon ${coupon.code}: usedCount=${coupon.usedCount} → ${activeCount}`)
    if (!dryRun) {
      await Coupon.updateOne({ _id: coupon._id }, { $set: { usedCount: activeCount } })
      couponFixed += 1
    }
  }

  // Post-check remaining mismatches (always, for apply + dry-run projection)
  for (const row of active) {
    const { couponId, customerId } = row._id
    const desired = row.activeCount
    if (dryRun) {
      // In dry-run, projected state matches desired for rows we would write
      continue
    }
    const existing = await CouponCustomerUsage.findOne({ couponId, customerId }).lean()
    if (!existing || Number(existing.activeCount || 0) !== desired) mismatchesAfter += 1
  }

  if (!dryRun) {
    const usageRows = await CouponCustomerUsage.find().lean()
    for (const row of usageRows) {
      const count = await CouponRedemption.countDocuments({
        couponId: row.couponId,
        customerId: row.customerId,
        status: { $ne: 'rolled_back' },
      })
      if (count !== Number(row.activeCount || 0)) mismatchesAfter += 1
    }
    for (const coupon of coupons) {
      const activeCount = await CouponRedemption.countDocuments({
        couponId: coupon._id,
        status: { $ne: 'rolled_back' },
      })
      const refreshed = await Coupon.findById(coupon._id).select('usedCount').lean()
      if (Number(refreshed?.usedCount || 0) !== activeCount) mismatchesAfter += 1
    }
  } else {
    mismatchesAfter = mismatchesBefore
  }

  const after = dryRun
    ? { ...before, projectedMismatches: mismatchesAfter }
    : {
        usageRows: await CouponCustomerUsage.countDocuments(),
        activeRedemptions: await CouponRedemption.countDocuments({ status: { $ne: 'rolled_back' } }),
        coupons: await Coupon.countDocuments(),
      }

  const report = {
    ok: mismatchesAfter === 0 || (dryRun === false && mismatchesAfter === 0),
    mode: dryRun ? 'dry-run' : 'apply',
    maintenanceModeRequired: !dryRun,
    before,
    after,
    mismatchesBefore,
    mismatchesAfter: dryRun ? mismatchesBefore : mismatchesAfter,
    usage_upserts: dryRun ? 0 : upserts,
    coupon_fixed: dryRun ? 0 : couponFixed,
  }
  // dry-run "ok" means no drift detected
  report.ok = report.mismatchesAfter === 0

  console.log(`REPORT ${JSON.stringify(report)}`)
  console.log(`Done. mismatches_before=${mismatchesBefore} mismatches_after=${report.mismatchesAfter} usage_upserts=${report.usage_upserts} coupon_fixed=${report.coupon_fixed}`)

  if (!report.ok) {
    process.exitCode = 2
  }
}

main()
  .then(() => disconnectDatabase())
  .catch(async (error) => {
    console.error(error)
    await disconnectDatabase().catch(() => null)
    process.exit(1)
  })
