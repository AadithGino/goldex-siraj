import { Order } from '../models/commerce.models.js'
import { logger } from '../config/logger.js'
import {
  getPaymobConfig,
  inquirePaymobTransaction,
  isPaymobPendingFlag,
  isPaymobSuccessFlag,
  paymobTransactionBelongsToOrder,
} from './paymob.service.js'
import { getTabbyConfig } from './tabby.service.js'
import { finalizeTabbyPayment } from './tabby.payment.service.js'
import { applyOnlinePaymentFromProvider, cancelOrder } from './order.service.js'

// Past this, uncaptured payments need manual capture/close on the Tabby Merchant Dashboard.
const MAX_TABBY_CAPTURE_ATTEMPTS = 20

function inferProvider(order) {
  if (order?.paymentProvider === 'tabby' || order?.tabbyPaymentId || order?.tabbyCheckoutId || order?.tabbyReference) return 'tabby'
  if (order?.paymentProvider === 'paymob' || order?.paymobIntentionId || order?.paymobOrderId || order?.paymobSpecialReference) return 'paymob'
  return 'paymob'
}

async function reconcilePaymobOrder(order) {
  const txn = await inquirePaymobTransaction({
    transactionId: null,
    merchantOrderId: order.paymobSpecialReference || null,
    paymobOrderId: order.paymobOrderId || null,
  })
  if (!txn) return { outcome: 'pending', reason: 'inquiry_not_found' }

  const belongs = paymobTransactionBelongsToOrder(txn, order, {
    inquiredByMerchantRef: Boolean(order.paymobSpecialReference),
  })
  if (!belongs) {
    logger.warn({ orderId: String(order._id), transactionId: txn?.id }, 'Payment reconciliation skipped mismatched Paymob transaction')
    return { outcome: 'mismatch', reason: 'order_mismatch' }
  }

  const success = isPaymobSuccessFlag(txn.success) && !isPaymobPendingFlag(txn.pending)
  if (!success) return { outcome: 'not_success', reason: 'not_captured' }

  const amountCents = Number(txn.amount_cents)
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { outcome: 'invalid_amount', reason: 'amount_missing' }
  }

  await applyOnlinePaymentFromProvider(order._id, {
    transactionId: String(txn.id),
    amount: amountCents / 100,
    payload: {
      provider: 'paymob',
      source: 'reconciliation',
      transaction: txn,
    },
  })
  return { outcome: 'paid' }
}

async function reconcileTabbyOrder(order) {
  if (!order.tabbyPaymentId) return { outcome: 'pending', reason: 'payment_id_missing' }
  const result = await finalizeTabbyPayment(order._id, { paymentId: order.tabbyPaymentId, source: 'reconciliation' })
  if (result.outcome === 'paid') return { outcome: 'paid' }
  if (['rejected', 'expired', 'closed_uncaptured'].includes(result.outcome)) {
    // Checkout-originated attempts kept the bag; release their stock/wallet/coupon hold.
    if (order.tabbyCartRetained && order.paymentStatus === 'pending' && order.status === 'placed') {
      await cancelOrder(order._id, null, `Tabby payment ${result.outcome}`)
    }
    return { outcome: 'not_success', reason: result.outcome }
  }
  return { outcome: 'pending', reason: result.outcome }
}

export async function reconcilePendingOnlinePayments({ limit = 25 } = {}) {
  const batchSize = Math.max(1, Number(limit) || 25)
  const paymobConfigured = getPaymobConfig().isConfigured
  const tabbyConfigured = getTabbyConfig().isConfigured
  const [pending, uncaptured] = await Promise.all([
    Order.find({
      paymentMethod: 'online',
      paymentStatus: 'pending',
      status: { $nin: ['cancelled', 'returned'] },
      $or: [
        { tabbyPaymentId: { $in: [null, ''] } },
        { paymentProvider: { $ne: 'tabby' } },
        { tabbyPaymentStatus: { $exists: false } },
        { tabbyPaymentStatus: null },
        { tabbyPaymentStatus: { $nin: ['REJECTED', 'EXPIRED', 'CLOSED'] } },
      ],
    })
      .sort({ updatedAt: 1 })
      .limit(batchSize),
    tabbyConfigured
      ? Order.find({
        paymentMethod: 'online',
        paymentProvider: 'tabby',
        paymentStatus: 'paid',
        status: { $nin: ['cancelled', 'returned'] },
        tabbyPaymentId: { $ne: null },
        tabbyCaptureStatus: { $ne: 'captured' },
        tabbyCaptureAttempts: { $lt: MAX_TABBY_CAPTURE_ATTEMPTS },
      })
        .sort({ updatedAt: 1 })
        .limit(batchSize)
      : [],
  ])
  const candidates = [...pending, ...uncaptured]

  const stats = {
    scanned: candidates.length,
    paid: 0,
    skipped: 0,
    pending: 0,
    not_success: 0,
    mismatch: 0,
    invalid_amount: 0,
    errors: 0,
  }

  for (const order of candidates) {
    const provider = inferProvider(order)
    if (provider === 'paymob' && !paymobConfigured) {
      stats.skipped += 1
      continue
    }
    if (provider === 'tabby' && !tabbyConfigured) {
      stats.skipped += 1
      continue
    }
    try {
      const result = provider === 'tabby'
        ? await reconcileTabbyOrder(order)
        : await reconcilePaymobOrder(order)
      if (result?.outcome && stats[result.outcome] != null) stats[result.outcome] += 1
      else stats.pending += 1
    } catch (error) {
      stats.errors += 1
      logger.error(
        { err: error, orderId: String(order._id), provider },
        'Payment reconciliation failed for order',
      )
    }
  }

  return stats
}

let workerTimer = null
let workerRunning = false

export function startPaymentReconciliationWorker({ intervalSeconds = 45, batchSize = 25 } = {}) {
  const everyMs = Math.max(10_000, Number(intervalSeconds || 45) * 1000)
  const perPassLimit = Math.max(1, Number(batchSize || 25))

  const tick = async () => {
    if (workerRunning) return
    workerRunning = true
    try {
      const stats = await reconcilePendingOnlinePayments({ limit: perPassLimit })
      if (stats.scanned > 0 || stats.errors > 0) {
        logger.info({ stats }, 'Payment reconciliation pass completed')
      }
    } catch (error) {
      logger.error({ err: error }, 'Payment reconciliation pass crashed')
    } finally {
      workerRunning = false
    }
  }

  // Initial quick pass after startup.
  setTimeout(() => {
    tick().catch(() => null)
  }, 5_000).unref()

  workerTimer = setInterval(() => {
    tick().catch(() => null)
  }, everyMs)
  workerTimer.unref()
  logger.info({ interval_ms: everyMs, batch_size: perPassLimit }, 'Payment reconciliation worker started')

  return () => {
    if (workerTimer) {
      clearInterval(workerTimer)
      workerTimer = null
    }
    logger.info('Payment reconciliation worker stopped')
  }
}
