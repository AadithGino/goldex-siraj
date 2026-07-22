import { roundMoney } from '../utils/money.js'
import { AppError } from '../utils/AppError.js'

/**
 * Allocate the paid order total across lines proportionally to lineTotal.
 * Last line receives the rounding remainder so the sum equals paidTotal.
 */
export function allocatePaidAmounts(order) {
  const items = order.items || []
  const paidTotal = roundMoney(Number(order.finalTotal ?? order.total ?? 0))
  const merchandise = roundMoney(items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0))
  let allocated = 0
  items.forEach((item, index) => {
    let share = 0
    if (index === items.length - 1) {
      share = roundMoney(Math.max(0, paidTotal - allocated))
    } else if (merchandise > 0) {
      share = roundMoney(paidTotal * (Number(item.lineTotal || 0) / merchandise))
      allocated = roundMoney(allocated + share)
    }
    item.paidAllocation = share
    if (item.returnedQty == null) item.returnedQty = 0
    if (item.refundedAmount == null) item.refundedAmount = 0
  })
  return paidTotal
}

export function remainingRefundable(order) {
  const paid = roundMoney(Number(order.finalTotal ?? order.total ?? 0))
  const already = roundMoney(Number(order.refundedTotal || 0))
  return roundMoney(Math.max(0, paid - already))
}

export function findOrderItem(order, orderItemId) {
  if (!orderItemId) return null
  return (order.items || []).find((item) => String(item.id || item._id) === String(orderItemId)) || null
}

export function remainingReturnableQty(item) {
  return Math.max(
    0,
    Number(item.qty || 0) - Number(item.returnedQty || 0) - Number(item.reservedReturnQty || 0),
  )
}

/** Units not yet physically returned (ignores open reservations) — used at completion/refund. */
export function remainingUnreturnedQty(item) {
  return Math.max(0, Number(item.qty || 0) - Number(item.returnedQty || 0))
}

/**
 * Remaining paid allocation for still-returnable units on a line.
 * Unit refund = remainingPaid / remainingQty (not original qty).
 */
export function computeLineReturnRefund(item, returnQty, orderRemaining) {
  const maxQty = remainingUnreturnedQty(item)
  if (maxQty <= 0) throw new AppError(409, 'ITEM_FULLY_RETURNED', 'This line has already been fully returned')
  const qty = Number(returnQty)
  if (!Number.isInteger(qty) || qty < 1 || qty > maxQty) {
    throw new AppError(422, 'INVALID_RETURN_QTY', `Return quantity must be between 1 and ${maxQty}`)
  }

  const linePaid = roundMoney(Number(item.paidAllocation || 0))
  const lineRefunded = roundMoney(Number(item.refundedAmount || 0))
  const lineRemaining = roundMoney(Math.max(0, linePaid - lineRefunded))
  const unit = maxQty > 0 ? lineRemaining / maxQty : 0
  const proportional = roundMoney(unit * qty)
  const amount = roundMoney(Math.min(proportional, lineRemaining, orderRemaining))
  return { refundAmount: amount, qty, maxQty, lineRemaining }
}

/**
 * Compute refund for a return completion.
 * Full order return: remaining refundable.
 * Line return: remaining allocation / remaining qty × requested qty, capped.
 */
export function computeReturnRefund(order, { orderItemId, qty } = {}) {
  if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'partially_refunded') {
    return { refundAmount: 0, items: [] }
  }
  const orderRemaining = remainingRefundable(order)
  if (!orderItemId) {
    return {
      refundAmount: orderRemaining,
      items: (order.items || []).map((item) => ({
        item,
        qty: remainingUnreturnedQty(item),
        amount: 0,
      })),
    }
  }

  const item = findOrderItem(order, orderItemId)
  if (!item) throw new AppError(422, 'INVALID_ORDER_ITEM', 'order_item_id does not belong to this order')
  const maxQty = remainingUnreturnedQty(item)
  const returnQty = qty == null ? maxQty : Number(qty)
  const { refundAmount, qty: resolvedQty } = computeLineReturnRefund(item, returnQty, orderRemaining)
  return {
    refundAmount,
    items: [{ item, qty: resolvedQty, amount: refundAmount }],
  }
}

export function applyItemReturnState(order, returnPlan) {
  for (const row of returnPlan.items) {
    if (!row.item || !row.qty) continue
    row.item.returnedQty = Number(row.item.returnedQty || 0) + row.qty
    row.item.reservedReturnQty = Math.max(0, Number(row.item.reservedReturnQty || 0) - row.qty)
    row.item.refundedAmount = roundMoney(Number(row.item.refundedAmount || 0) + Number(row.amount || 0))
  }
  const allReturned = (order.items || []).every((item) => Number(item.returnedQty || 0) >= Number(item.qty || 0))
  return allReturned ? 'returned' : 'partially_returned'
}
