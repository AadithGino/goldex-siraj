import * as orderService from '../../services/order.service.js'
import {
  isPaymobPendingFlag,
  isPaymobSuccessFlag,
  resolveGoldexOrderId,
  verifyPaymobTransactionHmac,
} from '../../services/paymob.service.js'
import { AppError } from '../../utils/AppError.js'
import { logger } from '../../config/logger.js'

function shouldRetryWebhook(error) {
  if (!(error instanceof AppError)) return true
  return Number(error.statusCode) >= 500
}

export async function handleWebhook(req, res) {
  const hmac = req.query.hmac
  const obj = req.body?.obj
  if (!obj || !verifyPaymobTransactionHmac(obj, hmac)) {
    logger.warn({ requestId: req.id }, 'Rejected Paymob webhook with invalid HMAC')
    return res.status(400).json({ success: false })
  }

  const rawOrderRef = obj.merchant_order_id
    || obj.order?.merchant_order_id
    || obj.special_reference
    || req.body?.special_reference
    || obj.order?.merchant_order_id

  const orderId = resolveGoldexOrderId(rawOrderRef)
  const success = isPaymobSuccessFlag(obj.success) && !isPaymobPendingFlag(obj.pending)

  if (success && orderId) {
    try {
      await orderService.applyOnlinePaymentFromProvider(orderId, {
        transactionId: String(obj.id),
        amount: Number(obj.amount_cents) / 100,
        payload: { provider: 'paymob', webhook: obj },
      })
      logger.info({ orderId, transactionId: obj.id, requestId: req.id }, 'Paymob webhook marked order paid')
    } catch (error) {
      logger.error({ err: error, orderId, rawOrderRef, requestId: req.id }, 'Paymob webhook processing failed')
      if (shouldRetryWebhook(error)) {
        return res.status(500).json({ success: false })
      }
    }
  } else {
    logger.info({
      orderId,
      rawOrderRef,
      success: obj.success,
      pending: obj.pending,
      requestId: req.id,
    }, 'Paymob webhook ignored (not a successful capture)')
  }

  return res.status(200).json({ success: true })
}
