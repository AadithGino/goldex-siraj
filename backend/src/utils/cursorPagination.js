import mongoose from 'mongoose'
import { AppError } from './AppError.js'

/** Stable storefront product order: merchandising order, then newest. */
export const PRODUCT_LIST_SORT = { displayOrder: 1, createdAt: -1, _id: -1 }

export function encodeProductCursor(doc) {
  if (!doc) return null
  const id = String(doc._id || doc.id || '')
  if (!id) return null
  const payload = {
    o: Number(doc.displayOrder ?? doc.display_order ?? 0) || 0,
    t: new Date(doc.createdAt || doc.created_at || 0).toISOString(),
    id,
  }
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function decodeProductCursor(cursor) {
  if (!cursor) return null
  try {
    const raw = Buffer.from(String(cursor), 'base64url').toString('utf8')
    const parsed = JSON.parse(raw)
    if (!parsed?.id || !mongoose.isValidObjectId(parsed.id)) {
      throw new AppError(422, 'INVALID_CURSOR', 'Invalid pagination cursor')
    }
    const createdAt = new Date(parsed.t)
    if (Number.isNaN(createdAt.getTime())) {
      throw new AppError(422, 'INVALID_CURSOR', 'Invalid pagination cursor')
    }
    return {
      displayOrder: Number(parsed.o) || 0,
      createdAt,
      id: new mongoose.Types.ObjectId(parsed.id),
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(422, 'INVALID_CURSOR', 'Invalid pagination cursor')
  }
}

/**
 * Keyset filter for PRODUCT_LIST_SORT after the last seen document.
 */
export function productCursorFilter(decoded) {
  if (!decoded) return null
  const { displayOrder, createdAt, id } = decoded
  return {
    $or: [
      { displayOrder: { $gt: displayOrder } },
      { displayOrder, createdAt: { $lt: createdAt } },
      { displayOrder, createdAt, _id: { $lt: id } },
    ],
  }
}
