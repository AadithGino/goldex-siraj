import { Customer } from '../models/auth.models.js'
import { Order, ReturnRequest, Review } from '../models/commerce.models.js'
import { Variant } from '../models/catalog.models.js'
import { AppError } from '../utils/AppError.js'
import {
  BUSINESS_TIMEZONE,
  dubaiMonthStartYmd,
  dubaiPaidAtRange,
  dubaiYmd,
  isYmd,
} from '../utils/dubaiTime.js'

/**
 * Dashboard contract (Asia/Dubai):
 * {
 *   timezone,
 *   today_sales, orders_today,
 *   month_sales, month_orders,
 *   orders_by_status,
 *   pending_orders, pending_reviews, pending_returns,
 *   low_stock_count, active_customer_count
 * }
 *
 * Sales report contract:
 * {
 *   timezone, gross_sales, refund_total, net_sales, total_sales (=net), order_count,
 *   by_day: [{ date, gross_sales, refund_total, net_sales, total_sales, order_count }]
 * }
 *
 * Top products contract:
 * [{ product_id, product_name, qty_sold, gross_revenue, refunded_amount, revenue (=net) }]
 */

const PAID_STATUSES = ['paid', 'partially_refunded', 'refunded']

function assertDateRange(from, to) {
  if (from != null && from !== '' && !isYmd(from)) throw new AppError(422, 'INVALID_DATE', 'from must be a real calendar YYYY-MM-DD')
  if (to != null && to !== '' && !isYmd(to)) throw new AppError(422, 'INVALID_DATE', 'to must be a real calendar YYYY-MM-DD')
  if (from && to && from > to) throw new AppError(422, 'INVALID_DATE_RANGE', 'from must be on or before to')
}

function paidMatch(from, to) {
  assertDateRange(from, to)
  const match = {
    paymentStatus: { $in: PAID_STATUSES },
    paidAt: { $ne: null, $type: 'date' },
  }
  const { fromUtc, toUtc } = dubaiPaidAtRange(from || null, to || null)
  if (fromUtc || toUtc) {
    match.paidAt = { $type: 'date' }
    if (fromUtc) match.paidAt.$gte = fromUtc
    if (toUtc) match.paidAt.$lte = toUtc
  }
  return match
}

/** Gross sale = server-finalized paid amount. */
export function grossOf(orderLike) {
  const gross = orderLike?.finalTotal ?? orderLike?.final_total ?? orderLike?.total
  return Math.max(0, Number(gross) || 0)
}

/** normalized refund = min(max(refundedTotal, 0), gross) */
export function normalizeRefundAmount(refundedTotal, gross) {
  const refund = Number(refundedTotal)
  const safeRefund = Number.isFinite(refund) ? Math.max(refund, 0) : 0
  const safeGross = Math.max(0, Number(gross) || 0)
  return Math.min(safeRefund, safeGross)
}

function grossSaleExpr() {
  return { $ifNull: ['$finalTotal', '$total'] }
}

/** normalized refund = min(max(refundedTotal, 0), gross) */
function refundExpr() {
  return {
    $min: [
      { $max: [{ $ifNull: ['$refundedTotal', 0] }, 0] },
      grossSaleExpr(),
    ],
  }
}

function netSaleExpr() {
  return {
    $max: [
      { $subtract: [grossSaleExpr(), refundExpr()] },
      0,
    ],
  }
}

export async function salesReport({ from, to } = {}) {
  const match = paidMatch(from, to)
  const [summary, byDay] = await Promise.all([
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          gross_sales: { $sum: grossSaleExpr() },
          refund_total: { $sum: refundExpr() },
          net_sales: { $sum: netSaleExpr() },
          order_count: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: BUSINESS_TIMEZONE } },
          gross_sales: { $sum: grossSaleExpr() },
          refund_total: { $sum: refundExpr() },
          net_sales: { $sum: netSaleExpr() },
          order_count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          gross_sales: 1,
          refund_total: 1,
          net_sales: 1,
          total_sales: '$net_sales',
          order_count: 1,
        },
      },
    ]),
  ])
  const gross = Number(summary[0]?.gross_sales || 0)
  const refund = Number(summary[0]?.refund_total || 0)
  const net = Number(summary[0]?.net_sales || 0)
  return {
    timezone: BUSINESS_TIMEZONE,
    gross_sales: gross,
    refund_total: refund,
    net_sales: net,
    total_sales: net,
    order_count: Number(summary[0]?.order_count || 0),
    by_day: byDay.map((row) => ({
      date: row.date,
      gross_sales: Number(row.gross_sales || 0),
      refund_total: Number(row.refund_total || 0),
      net_sales: Number(row.net_sales || 0),
      total_sales: Number(row.total_sales || 0),
      order_count: Number(row.order_count || 0),
    })),
  }
}

export async function topProducts(limit = 10, from, to) {
  const match = paidMatch(from, to)
  return Order.aggregate([
    { $match: match },
    { $unwind: '$items' },
    {
      $addFields: {
        item_gross: {
          $cond: [
            { $gt: [{ $ifNull: ['$items.paidAllocation', 0] }, 0] },
            '$items.paidAllocation',
            { $ifNull: ['$items.lineTotal', 0] },
          ],
        },
        item_refunded: {
          $min: [
            { $max: [{ $ifNull: ['$items.refundedAmount', 0] }, 0] },
            {
              $cond: [
                { $gt: [{ $ifNull: ['$items.paidAllocation', 0] }, 0] },
                '$items.paidAllocation',
                { $ifNull: ['$items.lineTotal', 0] },
              ],
            },
          ],
        },
      },
    },
    {
      $addFields: {
        item_net: { $max: [{ $subtract: ['$item_gross', '$item_refunded'] }, 0] },
      },
    },
    {
      $group: {
        _id: '$items.productId',
        product_name: { $first: '$items.productName' },
        qty_sold: { $sum: '$items.qty' },
        gross_revenue: { $sum: '$item_gross' },
        refunded_amount: { $sum: '$item_refunded' },
        revenue: { $sum: '$item_net' },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: Math.min(Math.max(Number(limit) || 10, 1), 100) },
    {
      $project: {
        _id: 0,
        product_id: '$_id',
        product_name: 1,
        qty_sold: 1,
        gross_revenue: 1,
        refunded_amount: 1,
        revenue: 1,
      },
    },
  ])
}

export async function dashboard() {
  const todayYmd = dubaiYmd()
  const monthStartYmd = dubaiMonthStartYmd()
  const todayMatch = paidMatch(todayYmd, todayYmd)
  const monthMatch = paidMatch(monthStartYmd, todayYmd)

  const [
    today,
    monthly,
    statusRows,
    pendingOrders,
    pendingReviews,
    pendingReturns,
    lowStock,
    activeCustomers,
  ] = await Promise.all([
    Order.aggregate([
      { $match: todayMatch },
      { $group: { _id: null, revenue: { $sum: netSaleExpr() }, orders: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: monthMatch },
      { $group: { _id: null, revenue: { $sum: netSaleExpr() }, orders: { $sum: 1 } } },
    ]),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.countDocuments({ status: { $in: ['placed', 'confirmed', 'processing', 'shipped'] } }),
    Review.countDocuments({ status: 'pending' }),
    ReturnRequest.countDocuments({ status: 'requested' }),
    Variant.countDocuments({ isActive: true, $expr: { $lte: ['$stockQty', '$lowStockThreshold'] } }),
    Customer.countDocuments({ isActive: true }),
  ])

  const ordersByStatus = Object.fromEntries(statusRows.map((row) => [row._id, Number(row.count || 0)]))

  return {
    timezone: BUSINESS_TIMEZONE,
    today_sales: Number(today[0]?.revenue || 0),
    orders_today: Number(today[0]?.orders || 0),
    month_sales: Number(monthly[0]?.revenue || 0),
    month_orders: Number(monthly[0]?.orders || 0),
    orders_by_status: ordersByStatus,
    pending_orders: pendingOrders,
    pending_reviews: pendingReviews,
    pending_returns: pendingReturns,
    low_stock_count: lowStock,
    active_customer_count: activeCustomers,
  }
}
