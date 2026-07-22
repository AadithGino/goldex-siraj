import { Coupon, CouponCustomerUsage, CouponRedemption } from '../models/commerce.models.js'
import { AppError } from '../utils/AppError.js'

/**
 * Atomically reserve global + per-customer coupon capacity and create an active redemption.
 * Must run inside a MongoDB transaction.
 *
 * Limits are always taken from the Coupon document inside the transaction
 * (never from a stale object read outside). Coordinates with admin updateCoupon
 * via conflicting writes on the same Coupon document.
 *
 * Never issues compensating writes after a duplicate-key error — that aborts the
 * transaction; the caller must retry the whole unit of work.
 */
export async function reserveCouponRedemption({
  couponId,
  customerId,
  orderId,
  discountAmount,
}, { session }) {
  if (!session) throw new AppError(500, 'SESSION_REQUIRED', 'Coupon reservation requires a MongoDB session')

  // Ensure per-customer usage tracker exists without mutating activeCount.
  try {
    await CouponCustomerUsage.updateOne(
      { couponId, customerId },
      { $setOnInsert: { couponId, customerId, activeCount: 0 } },
      { upsert: true, session },
    )
  } catch (error) {
    // Duplicate-key aborts the transaction; rethrow for whole-txn retry.
    if (error?.code === 11000) throw error
    throw error
  }

  // Atomic vs admin usage_limit updates: compare usedCount to the document's
  // current usageLimit (null = unlimited), not a caller-supplied stale value.
  const coupon = await Coupon.findOneAndUpdate(
    {
      _id: couponId,
      $expr: {
        $or: [
          { $eq: [{ $ifNull: ['$usageLimit', null] }, null] },
          { $lt: ['$usedCount', '$usageLimit'] },
        ],
      },
    },
    { $inc: { usedCount: 1 } },
    { new: true, session },
  )
  if (!coupon) throw new AppError(409, 'COUPON_USAGE_LIMIT', 'Coupon usage limit has been reached')

  const limit = Math.max(1, Number(coupon.perCustomerLimit) || 1)

  const customerUsage = await CouponCustomerUsage.findOneAndUpdate(
    { couponId, customerId, activeCount: { $lt: limit } },
    { $inc: { activeCount: 1 } },
    { new: true, session },
  )
  if (!customerUsage) {
    // Abort transaction so usedCount increment rolls back — no compensating write.
    throw new AppError(409, 'COUPON_CUSTOMER_LIMIT', 'You have already used this coupon the maximum number of times')
  }

  try {
    const [redemption] = await CouponRedemption.create([{
      couponId,
      customerId,
      orderId,
      discountAmount,
      status: 'active',
    }], { session })
    return redemption
  } catch (error) {
    if (error?.code === 11000) {
      const mapped = new AppError(409, 'COUPON_ALREADY_APPLIED', 'Coupon already applied to this order')
      mapped.cause = error
      throw mapped
    }
    throw error
  }
}

/** Roll back an active redemption and free global/per-customer capacity once. */
export async function rollbackCouponRedemption({ orderId, reason, staffId }, { session }) {
  if (!session) throw new AppError(500, 'SESSION_REQUIRED', 'Coupon rollback requires a MongoDB session')

  const redemption = await CouponRedemption.findOneAndUpdate(
    { orderId, status: { $ne: 'rolled_back' } },
    {
      $set: {
        status: 'rolled_back',
        rolledBackAt: new Date(),
        rollbackReason: reason || 'Order cancelled',
        rolledBackBy: staffId || null,
      },
    },
    { new: true, session },
  )
  if (!redemption) return null

  await Coupon.updateOne(
    { _id: redemption.couponId, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } },
    { session },
  )
  await CouponCustomerUsage.updateOne(
    { couponId: redemption.couponId, customerId: redemption.customerId, activeCount: { $gt: 0 } },
    { $inc: { activeCount: -1 } },
    { session },
  )
  return redemption
}
