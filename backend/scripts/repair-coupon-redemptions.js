/**
 * Optional legacy repair: recreate rolled_back CouponRedemption rows for cancelled
 * orders that still have couponCode but lost their redemption (deleted on cancel).
 *
 * Does not run on application startup.
 *
 * Usage:
 *   node scripts/repair-coupon-redemptions.js --dry-run
 *   node scripts/repair-coupon-redemptions.js
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { Coupon, CouponRedemption, Order } from '../src/models/commerce.models.js'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  await connectDatabase()
  const orders = await Order.find({
    status: 'cancelled',
    couponCode: { $nin: [null, ''] },
  }).select('_id customerId couponCode discountAmount createdAt placedAt statusHistory').lean()

  let created = 0
  let skipped = 0

  console.log(`Repairing missing rolled-back redemptions (${dryRun ? 'dry-run' : 'apply'})…`)

  for (const order of orders) {
    const existing = await CouponRedemption.findOne({ orderId: order._id }).lean()
    if (existing) {
      skipped += 1
      continue
    }

    const code = String(order.couponCode || '').trim().toUpperCase()
    const coupon = await Coupon.findOne({ code }).select('_id code').lean()
    if (!coupon) {
      console.log(`  skip order ${order._id}: coupon ${code} not found`)
      skipped += 1
      continue
    }

    const cancelEntry = [...(order.statusHistory || [])].reverse().find((entry) => entry.status === 'cancelled')
    const rolledBackAt = cancelEntry?.createdAt || order.placedAt || order.createdAt || new Date()
    const rollbackReason = cancelEntry?.note || 'Legacy repair: order cancelled'
    const payload = {
      couponId: coupon._id,
      customerId: order.customerId,
      orderId: order._id,
      discountAmount: Number(order.discountAmount || 0),
      status: 'rolled_back',
      rolledBackAt,
      rollbackReason,
      rolledBackBy: cancelEntry?.changedBy || null,
      createdAt: order.placedAt || order.createdAt || rolledBackAt,
    }

    console.log(`  recreate rolled_back redemption for order ${order._id} / ${code} (AED ${payload.discountAmount})`)
    if (!dryRun) {
      await CouponRedemption.create(payload)
      created += 1
    } else {
      created += 1
    }
  }

  console.log(`Done. Would create/created: ${created}. Skipped: ${skipped}.`)
}

main()
  .then(() => disconnectDatabase())
  .catch(async (error) => {
    console.error(error)
    await disconnectDatabase().catch(() => null)
    process.exit(1)
  })
