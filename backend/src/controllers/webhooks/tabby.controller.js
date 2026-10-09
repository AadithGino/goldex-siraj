import { Order } from '../../models/commerce.models.js'
import { finalizeTabbyPayment } from '../../services/tabby.payment.service.js'
import {
  resolveGoldexOrderIdFromTabbyReference,
  verifyTabbyWebhookAuth,
} from '../../services/tabby.service.js'
import { logger } from '../../config/logger.js'

const ACTIONABLE_STATUSES = new Set(['authorized', 'closed'])

/**
 * Webhooks are notifications only: the payment is re-fetched with Retrieve Payment
 * before anything is marked paid or captured. Duplicates and out-of-order delivery are
 * safe because finalizeTabbyPayment is idempotent and never downgrades a status.
 */
export async function handleWebhook(req, res) {
  if (!verifyTabbyWebhookAuth(req.headers)) {
    logger.warn({ requestId: req.id }, 'Rejected Tabby webhook with invalid auth header')
    return res.status(401).json({ success: false })
  }

  const body = req.body || {}
  const paymentId = body.id ? String(body.id) : null
  const status = String(body.status || '').toLowerCase()
  const reference = body.order?.reference_id || null
  logger.info({
    requestId: req.id,
    paymentId,
    status,
    reference,
    isTest: body.is_test,
    captures: Array.isArray(body.captures) ? body.captures.length : 0,
    refunds: Array.isArray(body.refunds) ? body.refunds.length : 0,
  }, 'Tabby webhook received')

  if (!paymentId || !ACTIONABLE_STATUSES.has(status)) {
    return res.status(200).json({ success: true })
  }

  const orderId = resolveGoldexOrderIdFromTabbyReference(reference)
  const order = orderId
    ? await Order.findById(orderId).select('_id paymentStatus tabbyCaptureStatus status').lean()
    : await Order.findOne({ tabbyPaymentId: paymentId }).select('_id paymentStatus tabbyCaptureStatus status').lean()
  if (!order) {
    // The order transaction may not have committed yet; a non-200 makes Tabby retry.
    return res.status(404).json({ success: false })
  }

  const alreadySettled = order.paymentStatus === 'paid' && order.tabbyCaptureStatus === 'captured'
  res.status(200).json({ success: true })
  await Order.updateOne({ _id: order._id }, { $set: { tabbyWebhookReceivedAt: new Date() } })
  if (alreadySettled) return

  finalizeTabbyPayment(order._id, { paymentId, source: 'webhook' })
    .then((result) => {
      logger.info({ orderId: String(order._id), paymentId, outcome: result.outcome }, 'Tabby webhook processed')
    })
    .catch((error) => {
      logger.error({ err: error, orderId: String(order._id), paymentId }, 'Tabby webhook processing failed; reconciliation will retry')
    })
}
