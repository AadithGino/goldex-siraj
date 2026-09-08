import * as orderService from '../../services/order.service.js'
import {
  extractTabbyPaymentData,
  isTabbyPendingStatus,
  isTabbySuccessStatus,
  resolveGoldexOrderIdFromTabbyReference,
  verifyTabbyWebhookSignature,
} from '../../services/tabby.service.js'
import { AppError } from '../../utils/AppError.js'
import { logger } from '../../config/logger.js'

function shouldRetryWebhook(error) {
  if (!(error instanceof AppError)) return true
  return Number(error.statusCode) >= 500
}

export async function handleWebhook(req, res) {
  const signature = req.headers['x-tabby-signature']
  if (!verifyTabbyWebhookSignature(req.rawBody, signature)) {
    logger.warn({ requestId: req.id }, 'Rejected Tabby webhook with invalid signature')
    return res.status(400).json({ success: false })
  }

  const payment = extractTabbyPaymentData(req.body || {})
  const orderId = resolveGoldexOrderIdFromTabbyReference(payment.orderReference)
  const success = isTabbySuccessStatus(payment.status) && !isTabbyPendingStatus(payment.status)

  if (success && orderId && payment.id && payment.amount > 0) {
    try {
      await orderService.applyOnlinePaymentFromProvider(orderId, {
        transactionId: payment.id,
        amount: payment.amount,
        payload: { provider: 'tabby', webhook: req.body },
      })
      logger.info({ orderId, transactionId: payment.id, requestId: req.id }, 'Tabby webhook marked order paid')
    } catch (error) {
      logger.error({ err: error, orderId, requestId: req.id }, 'Tabby webhook processing failed')
      if (shouldRetryWebhook(error)) {
        return res.status(500).json({ success: false })
      }
    }
  } else {
    logger.info({
      orderId,
      status: payment.status,
      requestId: req.id,
    }, 'Tabby webhook ignored (not a successful capture)')
  }

  return res.status(200).json({ success: true })
}

