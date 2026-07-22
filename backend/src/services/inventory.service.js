import { createHash } from 'node:crypto'
import mongoose from 'mongoose'
import { Variant } from '../models/catalog.models.js'
import { StockMovement } from '../models/rate.models.js'
import { AppError } from '../utils/AppError.js'
import { paginationMeta, parsePagination } from '../utils/pagination.js'

function isDuplicateKey(error) {
  return error?.code === 11000 || error?.cause?.code === 11000
}

export function stockRequestHash({
  operationType,
  variantId,
  delta,
  qty,
  expectedBefore,
  reason,
}) {
  const canonical = JSON.stringify({
    operationType: String(operationType || ''),
    variantId: String(variantId || ''),
    delta: delta == null ? null : Number(delta),
    qty: qty == null ? null : Number(qty),
    expectedBefore: expectedBefore == null ? null : Number(expectedBefore),
    reason: String(reason || 'admin_adjustment'),
  })
  return createHash('sha256').update(canonical).digest('hex')
}

async function resolveIdempotentMovement(idempotencyKey, { variantId, requestHash, operationType }, session = null) {
  const query = StockMovement.findOne({ idempotencyKey })
  if (session) query.session(session)
  const existing = await query
  if (!existing) return null

  const existingHash = existing.requestHash || null
  const existingOp = existing.operationType || null
  const existingTarget = String(existing.variantId)
  if (
    (requestHash && existingHash && existingHash !== requestHash)
    || (operationType && existingOp && existingOp !== operationType)
    || (variantId && existingTarget !== String(variantId))
  ) {
    throw new AppError(
      409,
      'IDEMPOTENCY_CONFLICT',
      'Idempotency key was already used for a different stock operation',
      {
        idempotency_key: idempotencyKey,
        existing_variant_id: existingTarget,
        existing_operation_type: existingOp,
      },
    )
  }

  const variantQuery = Variant.findById(variantId || existing.variantId)
  if (session) variantQuery.session(session)
  return variantQuery
}

/**
 * Single inventory mutation path: update Variant stock and write StockMovement
 * in the same MongoDB transaction/session.
 */
export async function applyStockDelta({
  variantId,
  delta,
  reason,
  note,
  referenceType,
  referenceId,
  idempotencyKey,
  actorId,
  session,
  requireAvailable = false,
  operationType = 'stock_delta',
  requestHash = null,
  expectedBefore = null,
  targetQty = null,
}) {
  if (!session) throw new AppError(500, 'SESSION_REQUIRED', 'Inventory mutations require a MongoDB session')
  const change = Number(delta)
  if (!Number.isFinite(change) || !Number.isInteger(change) || change === 0) {
    throw new AppError(422, 'INVALID_STOCK_ADJUSTMENT', 'Stock delta must be a non-zero integer')
  }

  const key = idempotencyKey != null && String(idempotencyKey).trim()
    ? String(idempotencyKey).trim()
    : null

  const hash = requestHash || stockRequestHash({
    operationType,
    variantId,
    delta: change,
    qty: targetQty,
    expectedBefore,
    reason: reason || 'admin_adjustment',
  })

  if (key) {
    const prior = await resolveIdempotentMovement(key, {
      variantId,
      requestHash: hash,
      operationType,
    }, session)
    if (prior) return prior
  }

  const filter = { _id: variantId }
  if (requireAvailable && change < 0) filter.stockQty = { $gte: Math.abs(change) }

  try {
    const updated = await Variant.findOneAndUpdate(
      filter,
      { $inc: { stockQty: change } },
      { new: true, session },
    )
    if (!updated) {
      if (requireAvailable && change < 0) {
        throw new AppError(409, 'INSUFFICIENT_STOCK', 'Requested quantity is unavailable')
      }
      throw new AppError(404, 'VARIANT_NOT_FOUND', 'Variant not found')
    }
    if (updated.stockQty < 0) {
      throw new AppError(422, 'INVALID_STOCK_ADJUSTMENT', 'Stock adjustment would create a negative quantity')
    }

    const qtyBefore = updated.stockQty - change
    await StockMovement.create([{
      variantId,
      delta: change,
      qtyBefore,
      qtyAfter: updated.stockQty,
      reason: reason || 'admin_adjustment',
      note: note || undefined,
      referenceType: referenceType || undefined,
      referenceId: referenceId || undefined,
      idempotencyKey: key || undefined,
      operationType,
      requestHash: hash,
      createdBy: actorId || undefined,
    }], { session })

    return updated
  } catch (error) {
    if (key && isDuplicateKey(error)) {
      throw error
    }
    throw error
  }
}

export async function adjustStock(variantId, delta, reason, note, actorId, { idempotencyKey } = {}) {
  const session = await mongoose.startSession()
  const operationType = 'adjust_stock'
  const hash = stockRequestHash({
    operationType,
    variantId,
    delta,
    reason: reason || 'admin_adjustment',
  })
  try {
    try {
      return await session.withTransaction(async () => applyStockDelta({
        variantId,
        delta,
        reason: reason || 'admin_adjustment',
        note,
        idempotencyKey,
        actorId,
        session,
        operationType,
        requestHash: hash,
        requireAvailable: Number(delta) < 0,
      }))
    } catch (error) {
      if (idempotencyKey && isDuplicateKey(error)) {
        const resolved = await resolveIdempotentMovement(String(idempotencyKey).trim(), {
          variantId,
          requestHash: hash,
          operationType,
        })
        if (resolved) return resolved
      }
      throw error
    }
  } finally {
    await session.endSession()
  }
}

/**
 * Absolute set-stock with optimistic concurrency via expectedBefore.
 */
export async function setStock(variantId, { qty, expectedBefore, reason, note, actorId, idempotencyKey }) {
  const target = Number(qty)
  if (!Number.isFinite(target) || !Number.isInteger(target) || target < 0) {
    throw new AppError(422, 'INVALID_STOCK_QTY', 'Stock quantity must be a non-negative integer')
  }
  if (expectedBefore == null || !Number.isFinite(Number(expectedBefore)) || !Number.isInteger(Number(expectedBefore))) {
    throw new AppError(422, 'EXPECTED_BEFORE_REQUIRED', 'expected_before is required for absolute set-stock')
  }
  const operationType = 'set_stock'
  const hash = stockRequestHash({
    operationType,
    variantId,
    qty: target,
    expectedBefore,
    reason: reason || 'admin_adjustment',
  })
  const session = await mongoose.startSession()
  try {
    try {
      return await session.withTransaction(async () => {
        if (idempotencyKey) {
          const prior = await resolveIdempotentMovement(String(idempotencyKey).trim(), {
            variantId,
            requestHash: hash,
            operationType,
          }, session)
          if (prior) return prior
        }
        const filter = { _id: variantId }
        if (expectedBefore != null) filter.stockQty = Number(expectedBefore)
        const current = await Variant.findOne(filter).session(session)
        if (!current) {
          throw new AppError(409, 'STOCK_VERSION_CONFLICT', 'Stock was changed by another operator; refresh and retry')
        }
        const delta = target - current.stockQty
        if (delta === 0) return current
        return applyStockDelta({
          variantId,
          delta,
          reason: reason || 'admin_adjustment',
          note,
          idempotencyKey,
          actorId,
          session,
          operationType,
          requestHash: hash,
          expectedBefore,
          targetQty: target,
        })
      })
    } catch (error) {
      if (idempotencyKey && isDuplicateKey(error)) {
        const resolved = await resolveIdempotentMovement(String(idempotencyKey).trim(), {
          variantId,
          requestHash: hash,
          operationType,
        })
        if (resolved) return resolved
      }
      throw error
    }
  } finally {
    await session.endSession()
  }
}

export async function stockLedger(query = {}) {
  const filter = {}
  if (query.variant_id) filter.variantId = query.variant_id
  if (query.reason && query.reason !== 'all') filter.reason = query.reason
  if (query.reference_type) filter.referenceType = query.reference_type
  if (query.reference_id) filter.referenceId = query.reference_id

  const search = String(query.search || query.q || '').trim()
  if (search) {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const variants = await Variant.find({
      $or: [{ sku: re }, { label: re }],
    }).select('_id').limit(200).lean()
    filter.$or = [
      { note: re },
      { reason: re },
      { variantId: { $in: variants.map((row) => row._id) } },
    ]
  }

  const { page, limit, skip } = parsePagination(query, { defaultLimit: 50, maxLimit: 100 })
  const [items, total] = await Promise.all([
    StockMovement.find(filter)
      .populate({ path: 'variantId', populate: { path: 'productId' } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    StockMovement.countDocuments(filter),
  ])
  return { items, ...paginationMeta(page, limit, total) }
}
