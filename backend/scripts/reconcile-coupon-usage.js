/**
 * Reconcile Coupon.usedCount with active CouponRedemption counts.
 *
 * Usage:
 *   node scripts/reconcile-coupon-usage.js
 *   node scripts/reconcile-coupon-usage.js --dry-run
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { Coupon, CouponRedemption } from '../src/models/commerce.models.js'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  await connectDatabase()
  const coupons = await Coupon.find().select('_id code usedCount').lean()
  let mismatches = 0
  let updated = 0

  console.log(`Reconciling coupon usedCount (${dryRun ? 'dry-run' : 'apply'})…`)
  console.log(`Redemption collection: ${CouponRedemption.collection.name}`)

  for (const coupon of coupons) {
    const activeCount = await CouponRedemption.countDocuments({
      couponId: coupon._id,
      status: { $ne: 'rolled_back' },
    })
    const current = Number(coupon.usedCount || 0)
    if (current === activeCount) continue

    mismatches += 1
    console.log(
      `  ${coupon.code} (${coupon._id}): usedCount=${current} → activeRedemptions=${activeCount}`,
    )

    if (!dryRun) {
      await Coupon.updateOne({ _id: coupon._id }, { $set: { usedCount: activeCount } })
      updated += 1
    }
  }

  console.log(`Done. Discrepancies: ${mismatches}. Updated: ${dryRun ? 0 : updated}.`)
}

main()
  .then(() => disconnectDatabase())
  .catch(async (error) => {
    console.error(error)
    await disconnectDatabase().catch(() => null)
    process.exit(1)
  })
