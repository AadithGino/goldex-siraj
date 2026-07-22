import mongoose from 'mongoose'
import { StoreSetting } from '../models/catalog.models.js'
import { Order, PaymentEvent, ReturnCoordination, ReturnRequest } from '../models/commerce.models.js'
import { AppError } from '../utils/AppError.js'
import { roundMoney } from '../utils/money.js'
import { applyStockDelta } from './inventory.service.js'
import { cancelOrder } from './order.service.js'
import {
  allocatePaidAmounts,
  applyItemReturnState,
  computeReturnRefund,
  findOrderItem,
  remainingReturnableQty,
} from './refund.service.js'
import { claimReturnProofsInSession } from './upload.service.js'
import * as walletService from './wallet.service.js'

export const listCustomerReturns = (customerId) => ReturnRequest.find({ customerId }).populate('orderId').sort({ requestedAt: -1 })
export const listAdminReturns = (query = {}) => ReturnRequest.find(query.status ? { status: query.status } : {}).populate('orderId customerId').sort({ requestedAt: -1 })

function isDuplicateKey(error) {
  return error?.code === 11000 || error?.cause?.code === 11000
}

async function ensureCoordination(orderId, session) {
  await ReturnCoordination.updateOne(
    { orderId },
    { $setOnInsert: { orderId, mode: 'idle', generation: 0, activeRequestCount: 0 } },
    { upsert: true, session },
  )
}

/**
 * Claim exclusive / shared return coordination for an order.
 * Modes: cancellation | whole_return | line_return
 */
async function claimReturnCoordination(orderId, mode, session) {
  await ensureCoordination(orderId, session)
  let filter
  if (mode === 'cancellation' || mode === 'whole_return') {
    filter = { orderId, mode: 'idle' }
  } else if (mode === 'line_return') {
    filter = { orderId, mode: { $in: ['idle', 'line_return'] } }
  } else {
    throw new AppError(500, 'INVALID_COORD_MODE', 'Unknown return coordination mode')
  }
  const claimed = await ReturnCoordination.findOneAndUpdate(
    filter,
    {
      $set: { mode },
      $inc: { generation: 1, activeRequestCount: 1 },
    },
    { new: true, session },
  )
  if (!claimed) {
    throw new AppError(409, 'RETURN_ALREADY_OPEN', 'An active return or cancellation already exists for this order')
  }
  return claimed
}

async function releaseReturnCoordination(orderId, session) {
  const coord = await ReturnCoordination.findOne({ orderId }).session(session)
  if (!coord) return
  coord.activeRequestCount = Math.max(0, Number(coord.activeRequestCount || 0) - 1)
  if (coord.activeRequestCount === 0) coord.mode = 'idle'
  await coord.save({ session })
}

async function releaseLineReservation(order, orderItemId, qty, session) {
  if (!orderItemId || !qty) return
  const updated = await Order.findOneAndUpdate(
    {
      _id: order.id || order._id,
      items: {
        $elemMatch: {
          _id: orderItemId,
          reservedReturnQty: { $gte: qty },
        },
      },
    },
    { $inc: { 'items.$.reservedReturnQty': -qty } },
    { new: true, session },
  )
  if (!updated) throw new AppError(409, 'RESERVATION_RELEASE_FAILED', 'Could not release return reservation')
}

/**
 * Atomically reserve return qty on an order line inside an open transaction.
 * Invariant: returnedQty + reservedReturnQty + newQty <= purchasedQty
 */
async function reserveLineQty(orderId, orderItemId, qty, session) {
  const order = await Order.findById(orderId).session(session)
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
  const item = findOrderItem(order, orderItemId)
  if (!item) throw new AppError(422, 'INVALID_ORDER_ITEM', 'order_item_id does not belong to this order')
  const remaining = remainingReturnableQty(item)
  if (qty > remaining) {
    throw new AppError(
      409,
      'RETURN_QTY_EXCEEDS_REMAINING',
      `Open return requests already reserve capacity; only ${remaining} remaining`,
    )
  }
  item.reservedReturnQty = Number(item.reservedReturnQty || 0) + qty
  await order.save({ session })
  return order
}

export async function requestReturn(customerId, input) {
  const session = await mongoose.startSession()
  try {
    try {
      return await session.withTransaction(async () => {
        const order = await Order.findOne({ _id: input.order_id, customerId }).session(session)
        if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
        const kind = input.kind

        if (kind === 'cancellation' && !['placed', 'confirmed', 'processing'].includes(order.status)) {
          throw new AppError(409, 'CANCELLATION_UNAVAILABLE', 'This order can no longer be cancelled')
        }
        if (kind === 'return') {
          if (order.status !== 'delivered' && order.status !== 'partially_returned') {
            throw new AppError(409, 'RETURN_UNAVAILABLE', 'Only delivered orders can be returned')
          }
          if (!order.deliveredAt) throw new AppError(409, 'RETURN_UNAVAILABLE', 'Only delivered orders can be returned')
          const settings = await StoreSetting.findOne({ singleton: 'default' }).session(session)
          const deadline = new Date(order.deliveredAt.getTime() + Number(settings?.returnWindowDays || 7) * 86_400_000)
          if (deadline < new Date()) throw new AppError(409, 'RETURN_WINDOW_CLOSED', 'The return window has closed')
        }

        let orderItemId = input.order_item_id || null
        let requestedQty = input.requested_qty != null ? Number(input.requested_qty)
          : (input.qty != null ? Number(input.qty) : null)

        const proofIds = [
          ...(input.proof_urls || []),
          ...(input.proof_keys || []),
        ]

        if (kind === 'cancellation') {
          await claimReturnCoordination(order.id, 'cancellation', session)

          const [created] = await ReturnRequest.create([{
            orderId: order.id,
            orderItemId: null,
            requestedQty: null,
            customerId,
            kind,
            reason: input.reason,
            proofUrls: [],
          }], { session })

          const proofUrls = await claimReturnProofsInSession(customerId, proofIds, created.id, session)
          created.proofUrls = proofUrls
          await created.save({ session })
          return created
        }

        // Whole-order return
        if (!orderItemId) {
          await claimReturnCoordination(order.id, 'whole_return', session)
          requestedQty = null
        } else {
          await claimReturnCoordination(order.id, 'line_return', session)

          const item = findOrderItem(order, orderItemId)
          if (!item) throw new AppError(422, 'INVALID_ORDER_ITEM', 'order_item_id does not belong to this order')
          const remaining = remainingReturnableQty(item)
          if (remaining <= 0) throw new AppError(409, 'ITEM_FULLY_RETURNED', 'This line has already been fully returned')
          if (requestedQty == null) requestedQty = remaining
          if (!Number.isInteger(requestedQty) || requestedQty < 1) {
            throw new AppError(422, 'INVALID_RETURN_QTY', 'requested_qty must be a positive integer')
          }
          if (requestedQty > remaining) {
            throw new AppError(422, 'INVALID_RETURN_QTY', `Return quantity must be between 1 and ${remaining}`)
          }
          await reserveLineQty(order.id, orderItemId, requestedQty, session)
        }

        const [created] = await ReturnRequest.create([{
          orderId: order.id,
          orderItemId,
          requestedQty,
          customerId,
          kind,
          reason: input.reason,
          proofUrls: [],
        }], { session })

        const proofUrls = await claimReturnProofsInSession(customerId, proofIds, created.id, session)
        created.proofUrls = proofUrls
        await created.save({ session })
        return created
      })
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new AppError(409, 'RETURN_ALREADY_OPEN', 'An active return request already exists')
      }
      throw error
    }
  } finally {
    session.endSession()
  }
}

export async function resolveReturn(id, input, staffId) {
  const request = await ReturnRequest.findById(id)
  if (!request) throw new AppError(404, 'RETURN_NOT_FOUND', 'Return request not found')
  if (!['approved', 'rejected', 'completed'].includes(input.status)) {
    throw new AppError(422, 'INVALID_RETURN_STATUS', 'Invalid return resolution')
  }

  // Idempotent completion: already completed → return as-is.
  if (request.status === 'completed' && input.status === 'completed') {
    return request
  }
  if (request.status === 'completed' || request.status === 'rejected') {
    throw new AppError(409, 'RETURN_ALREADY_RESOLVED', 'Return has already been resolved')
  }

  if (input.status === 'rejected') {
    const session = await mongoose.startSession()
    try {
      return await session.withTransaction(async () => {
        const locked = await ReturnRequest.findOneAndUpdate(
          { _id: id, status: { $in: ['requested', 'approved'] } },
          {
            $set: {
              status: 'rejected',
              resolvedBy: staffId,
              resolvedAt: new Date(),
              resolutionNote: input.resolution_note,
            },
          },
          { new: true, session },
        )
        if (!locked) throw new AppError(409, 'RETURN_ALREADY_RESOLVED', 'Return has already been resolved')
        if (locked.kind === 'return' && locked.orderItemId && locked.requestedQty) {
          const order = await Order.findById(locked.orderId).session(session)
          if (order) await releaseLineReservation(order, locked.orderItemId, locked.requestedQty, session)
        }
        await releaseReturnCoordination(locked.orderId, session)
        return locked
      })
    } finally {
      session.endSession()
    }
  }

  if (request.kind === 'cancellation' && input.status === 'approved') {
    const session = await mongoose.startSession()
    try {
      return await session.withTransaction(async () => {
        const locked = await ReturnRequest.findOneAndUpdate(
          { _id: id, kind: 'cancellation', status: { $in: ['requested', 'approved'] } },
          {
            $set: {
              status: 'completed',
              resolvedBy: staffId,
              resolvedAt: new Date(),
              resolutionNote: input.resolution_note,
            },
          },
          { new: true, session },
        )
        if (!locked) {
          const current = await ReturnRequest.findById(id).session(session)
          if (current?.status === 'completed') return current
          throw new AppError(409, 'RETURN_ALREADY_RESOLVED', 'Return has already been resolved')
        }
        await cancelOrder(locked.orderId, staffId, input.resolution_note || 'Cancellation approved', { session })
        await releaseReturnCoordination(locked.orderId, session)
        return locked
      })
    } finally {
      session.endSession()
    }
  }

  if (input.status === 'approved') {
    const locked = await ReturnRequest.findOneAndUpdate(
      { _id: id, status: 'requested' },
      {
        $set: {
          status: 'approved',
          resolvedBy: staffId,
          resolutionNote: input.resolution_note,
        },
      },
      { new: true },
    )
    if (!locked) {
      const current = await ReturnRequest.findById(id)
      if (current?.status === 'approved') return current
      throw new AppError(409, 'RETURN_ALREADY_RESOLVED', 'Return has already been resolved')
    }
    return locked
  }

  // Complete return (must be approved)
  const session = await mongoose.startSession()
  try {
    return await session.withTransaction(async () => {
      const locked = await ReturnRequest.findOneAndUpdate(
        { _id: id, status: 'approved' },
        { $set: { status: 'completed', resolvedBy: staffId, resolvedAt: new Date(), resolutionNote: input.resolution_note } },
        { new: true, session },
      )
      if (!locked) {
        const current = await ReturnRequest.findById(id).session(session)
        if (current?.status === 'completed') return current
        if (current?.status !== 'approved') {
          throw new AppError(409, 'RETURN_NOT_APPROVED', 'Approve the return before completing it')
        }
        throw new AppError(409, 'RETURN_ALREADY_RESOLVED', 'Return has already been resolved')
      }

      const order = await Order.findById(locked.orderId).session(session)
      if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')

      if (locked.orderItemId && !findOrderItem(order, locked.orderItemId)) {
        throw new AppError(422, 'INVALID_ORDER_ITEM', 'order_item_id does not belong to this order')
      }

      if (order.paymentStatus === 'paid' && !(order.items || []).some((item) => Number(item.paidAllocation || 0) > 0)) {
        allocatePaidAmounts(order)
      }

      const plan = computeReturnRefund(order, {
        orderItemId: locked.orderItemId || null,
        qty: locked.orderItemId ? locked.requestedQty : null,
      })

      for (const row of plan.items) {
        if (!row.qty) continue
        await applyStockDelta({
          variantId: row.item.variantId,
          delta: row.qty,
          reason: 'order_returned',
          referenceType: 'return',
          referenceId: locked.id,
          idempotencyKey: `return:${locked.id}:${row.item.variantId}`,
          actorId: staffId,
          session,
        })
      }

      if (!locked.orderItemId) {
        const remainingLines = plan.items.filter((row) => row.qty > 0)
        const merchandise = remainingLines.reduce(
          (sum, row) => sum + Math.max(0, Number(row.item.paidAllocation || 0) - Number(row.item.refundedAmount || 0)),
          0,
        )
        let allocated = 0
        remainingLines.forEach((row, index) => {
          if (index === remainingLines.length - 1) {
            row.amount = roundMoney(plan.refundAmount - allocated)
          } else if (merchandise > 0) {
            const lineRem = Math.max(0, Number(row.item.paidAllocation || 0) - Number(row.item.refundedAmount || 0))
            row.amount = roundMoney(plan.refundAmount * (lineRem / merchandise))
            allocated = roundMoney(allocated + row.amount)
          }
        })
        plan.items = remainingLines
      }

      if (plan.refundAmount > 0) {
        await walletService.credit({
          customerId: order.customerId,
          amount: plan.refundAmount,
          type: 'refund',
          referenceType: 'return',
          referenceId: locked.id,
          idempotencyKey: `return-refund:${locked.id}`,
          note: `Wallet refund for ${order.orderNumber}`,
          createdBy: staffId,
        }, { session })
        await PaymentEvent.create([{
          orderId: order.id,
          provider: 'wallet',
          eventType: 'order_return_refund',
          transactionId: `return-refund:${locked.id}`,
          amount: plan.refundAmount,
          currency: 'AED',
          verified: true,
          payload: {
            return_request_id: locked.id,
            order_item_id: locked.orderItemId || null,
            requested_qty: locked.requestedQty,
          },
          processedAt: new Date(),
        }], { session })
        order.refundedTotal = roundMoney(Number(order.refundedTotal || 0) + plan.refundAmount)
      }

      const nextStatus = applyItemReturnState(order, plan)
      order.status = nextStatus
      const paid = roundMoney(Number(order.finalTotal ?? order.total ?? 0))
      order.paymentStatus = order.refundedTotal >= paid && paid > 0
        ? 'refunded'
        : (order.refundedTotal > 0 ? 'partially_refunded' : order.paymentStatus)
      order.statusHistory.push({
        status: nextStatus,
        note: input.resolution_note || 'Return completed',
        changedBy: staffId,
      })
      await order.save({ session })
      await releaseReturnCoordination(locked.orderId, session)
      return locked
    })
  } finally {
    session.endSession()
  }
}
