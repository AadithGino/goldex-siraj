import { logger } from '../config/logger.js'
import { CartItem, Order } from '../models/commerce.models.js'
import { AppError } from '../utils/AppError.js'
import { roundMoney } from '../utils/money.js'
import { applyOnlinePaymentFromProvider, cancelOrder } from './order.service.js'
import {
  captureTabbyPayment,
  closeTabbyPayment,
  extractTabbyPaymentData,
  refundTabbyPayment,
  resolveGoldexOrderIdFromTabbyReference,
  retrieveTabbyPayment,
  tabbyCaptureReferenceId,
} from './tabby.service.js'

const STALE_CAPTURE_CLAIM_MS = 2 * 60 * 1000

function assertPaymentBelongsToOrder(order, payment, requestedPaymentId) {
  const refOrderId = resolveGoldexOrderIdFromTabbyReference(payment.orderReference)
  if (refOrderId && refOrderId !== String(order._id)) {
    throw new AppError(409, 'ORDER_MISMATCH', 'Tabby payment does not match this order')
  }
  if (!refOrderId && String(requestedPaymentId) !== String(order.tabbyPaymentId || '')) {
    throw new AppError(409, 'ORDER_MISMATCH', 'Tabby payment does not match this order')
  }
}

async function releaseRetainedCart(orderId) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, tabbyCartRetained: true },
    { $set: { tabbyCartRetained: false } },
    { new: false },
  )
  if (!order) return
  const variantIds = (order.items || []).map((item) => item.variantId).filter(Boolean)
  if (!variantIds.length) return
  await CartItem.deleteMany({ customerId: order.customerId, variantId: { $in: variantIds } })
}

async function recordCapture(orderId, payment) {
  const captureRef = tabbyCaptureReferenceId(orderId)
  const capture = payment.captures.find((row) => row?.reference_id === captureRef) || payment.captures.at(-1)
  await Order.updateOne({ _id: orderId }, {
    $set: {
      tabbyCaptureStatus: 'captured',
      tabbyCaptureId: capture?.id ? String(capture.id) : null,
      tabbyCapturedAmount: payment.capturedAmount,
      tabbyCapturedAt: capture?.created_at ? new Date(capture.created_at) : new Date(),
      tabbyCaptureError: null,
    },
  })
}

/**
 * Full capture with a local claim (only one caller wins) plus an order-derived
 * `reference_id`, so redirect, webhook and reconciliation can never double-capture.
 */
async function captureWithClaim(orderId, payment) {
  const claimed = await Order.findOneAndUpdate(
    {
      _id: orderId,
      $or: [
        { tabbyCaptureStatus: { $nin: ['in_progress', 'captured'] } },
        { tabbyCaptureStatus: 'in_progress', updatedAt: { $lt: new Date(Date.now() - STALE_CAPTURE_CLAIM_MS) } },
      ],
    },
    { $set: { tabbyCaptureStatus: 'in_progress' }, $inc: { tabbyCaptureAttempts: 1 } },
    { new: true },
  )
  if (!claimed) return { captured: false, reason: 'claimed_elsewhere' }

  const referenceId = tabbyCaptureReferenceId(orderId)
  try {
    let result
    try {
      result = await captureTabbyPayment(payment.id, { amount: payment.amount, referenceId })
    } catch (error) {
      const latest = extractTabbyPaymentData(await retrieveTabbyPayment(payment.id))
      if (latest.capturedAmount > 0) {
        result = latest.raw
      } else if (latest.status === 'AUTHORIZED') {
        result = await captureTabbyPayment(payment.id, { amount: payment.amount, referenceId })
      } else {
        throw error
      }
    }
    const after = extractTabbyPaymentData(result)
    if (!(after.capturedAmount > 0)) {
      throw new AppError(502, 'TABBY_CAPTURE_UNCONFIRMED', 'Tabby capture response has no capture entry')
    }
    await recordCapture(orderId, after)
    logger.info({ orderId: String(orderId), paymentId: payment.id, amount: after.capturedAmount }, 'Tabby payment captured')
    return { captured: true }
  } catch (error) {
    await Order.updateOne({ _id: orderId }, {
      $set: { tabbyCaptureStatus: 'failed', tabbyCaptureError: String(error?.message || error).slice(0, 500) },
    })
    logger.error({ err: error, orderId: String(orderId), paymentId: payment.id }, 'Tabby capture failed; reconciliation will retry')
    return { captured: false, reason: 'capture_failed' }
  }
}

/**
 * Single source of truth for Tabby payment processing: verify with Retrieve Payment,
 * mark the order paid, release the retained bag and capture the full amount.
 * Used by the success redirect, the webhook and the reconciliation worker.
 */
export async function finalizeTabbyPayment(orderId, { paymentId = null, source = 'unknown' } = {}) {
  const order = await Order.findById(orderId)
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
  const id = paymentId || order.tabbyPaymentId
  if (!id) return { outcome: 'pending', order }

  const raw = await retrieveTabbyPayment(id)
  const payment = extractTabbyPaymentData(raw)
  if (!payment.id) return { outcome: 'pending', order }
  assertPaymentBelongsToOrder(order, payment, id)

  if (payment.status === 'CREATED') return { outcome: 'pending', order }
  if (payment.status === 'REJECTED' || payment.status === 'EXPIRED') {
    return { outcome: payment.status.toLowerCase(), order }
  }
  if (payment.status === 'CLOSED' && !(payment.capturedAmount > 0)) {
    return { outcome: 'closed_uncaptured', order }
  }
  if (payment.status !== 'AUTHORIZED' && payment.status !== 'CLOSED') {
    return { outcome: 'pending', order }
  }

  if (['cancelled', 'returned'].includes(order.status) && order.paymentStatus !== 'paid') {
    if (payment.status === 'AUTHORIZED' && !(payment.capturedAmount > 0)) {
      await closeTabbyPayment(payment.id)
      logger.warn({ orderId: String(order._id), paymentId: payment.id, source }, 'Closed Tabby payment authorized for a cancelled order')
      return { outcome: 'voided', order }
    }
    logger.error({ orderId: String(order._id), paymentId: payment.id, source }, 'Captured Tabby payment on a cancelled order needs manual review')
    return { outcome: 'needs_review', order }
  }

  if (payment.currency !== 'AED') {
    throw new AppError(409, 'CURRENCY_MISMATCH', `Unexpected Tabby currency ${payment.currency}`)
  }

  if (order.tabbyPaymentId !== payment.id) {
    await Order.updateOne({ _id: order._id }, { $set: { tabbyPaymentId: payment.id } })
  }

  if (order.paymentStatus !== 'paid') {
    await applyOnlinePaymentFromProvider(order._id, {
      transactionId: payment.id,
      amount: payment.amount,
      payload: { provider: 'tabby', source, payment: raw },
    })
  }
  await releaseRetainedCart(order._id)

  if (payment.capturedAmount > 0) {
    if (order.tabbyCaptureStatus !== 'captured') await recordCapture(order._id, payment)
  } else {
    await captureWithClaim(order._id, payment)
  }

  return { outcome: 'paid', order: await Order.findById(order._id) }
}

/**
 * Customer came back through the cancel/failure URL. Orders placed from checkout keep the
 * bag, so the pending order is cancelled (releasing stock, wallet and coupon) once Tabby
 * confirms the payment did not go through.
 */
export async function abandonTabbyOrder(customerId, orderId) {
  const order = await Order.findOne({ _id: orderId, customerId })
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (order.paymentStatus === 'paid') return { outcome: 'paid' }
  if (order.status === 'cancelled') return { outcome: 'cancelled' }
  if (order.paymentMethod !== 'online' || order.paymentProvider !== 'tabby' || !order.tabbyCartRetained) {
    return { outcome: 'kept' }
  }

  if (order.tabbyPaymentId) {
    let payment
    try {
      payment = extractTabbyPaymentData(await retrieveTabbyPayment(order.tabbyPaymentId))
    } catch (error) {
      logger.warn({ err: error, orderId: String(order._id) }, 'Tabby status unavailable while abandoning order; leaving for reconciliation')
      return { outcome: 'unknown' }
    }
    if (payment.status === 'AUTHORIZED' || (payment.status === 'CLOSED' && payment.capturedAmount > 0)) {
      const result = await finalizeTabbyPayment(order._id, { paymentId: payment.id, source: 'abandon_check' })
      return { outcome: result.outcome }
    }
  }

  await cancelOrder(order._id, null, 'Tabby payment not completed')
  return { outcome: 'cancelled' }
}

/**
 * Sends the Tabby-paid share of a refund back through Tabby. Returns the amount handled by
 * Tabby; the caller credits any remainder (the wallet-paid share) to the wallet.
 * `reference_id` must be stable per business refund so retries replay instead of duplicating.
 */
export async function refundOrderViaTabby(order, { amount, referenceId, reason, fullCancel = false }) {
  if (order.paymentProvider !== 'tabby' || !order.tabbyPaymentId) return { tabbyAmount: 0 }
  const externalPaid = roundMoney(Number(order.paymentCollection?.amount || 0))
  const remaining = roundMoney(Math.max(0, externalPaid - Number(order.tabbyRefundedTotal || 0)))
  let tabbyAmount = roundMoney(Math.min(Number(amount || 0), remaining))
  if (!(tabbyAmount > 0)) return { tabbyAmount: 0 }

  const payment = extractTabbyPaymentData(await retrieveTabbyPayment(order.tabbyPaymentId))

  if (payment.status === 'AUTHORIZED' && !(payment.capturedAmount > 0)) {
    if (!fullCancel) {
      throw new AppError(409, 'TABBY_NOT_CAPTURED', 'Tabby payment is not captured yet. Try again in a few minutes.')
    }
    await closeTabbyPayment(payment.id)
    order.tabbyCaptureStatus = null
    order.tabbyRefundedTotal = roundMoney(Number(order.tabbyRefundedTotal || 0) + tabbyAmount)
    return { tabbyAmount, method: 'close' }
  }
  if (payment.status !== 'CLOSED') {
    throw new AppError(409, 'TABBY_REFUND_UNAVAILABLE', `Tabby payment cannot be refunded in status ${payment.status || 'unknown'}`)
  }

  const alreadyRefunded = payment.refunds.find((row) => row?.reference_id === String(referenceId))
  if (alreadyRefunded) {
    tabbyAmount = roundMoney(Number(alreadyRefunded.amount || 0))
  } else {
    tabbyAmount = roundMoney(Math.min(tabbyAmount, payment.capturedAmount - payment.refundedAmount))
    if (!(tabbyAmount > 0)) return { tabbyAmount: 0 }
    await refundTabbyPayment(payment.id, { amount: tabbyAmount, referenceId, reason })
  }
  order.tabbyRefundedTotal = roundMoney(Number(order.tabbyRefundedTotal || 0) + tabbyAmount)
  return { tabbyAmount, method: 'refund' }
}
