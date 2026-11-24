import mongoose from 'mongoose'
import { AppError } from './AppError.js'

/** Stable storefront product order: merchandising order, then newest. */
export const PRODUCT_LIST_SORT = { displayOrder: 1, createdAt: -1, _id: -1 }

export const PRODUCT_SORT_KEYS = ['featured', 'newest', 'price_asc', 'price_desc', 'default']

export function resolveProductListSort(sortKey = 'featured') {
  switch (sortKey) {
    case 'newest':
      return { createdAt: -1, _id: -1 }
    case 'featured':
      return { isFeatured: -1, displayOrder: 1, createdAt: -1, _id: -1 }
    case 'default':
      return PRODUCT_LIST_SORT
    default:
      // price_* handled outside keyset sort
      return { isFeatured: -1, displayOrder: 1, createdAt: -1, _id: -1 }
  }
}

export function normalizeProductSortKey(raw) {
  const key = String(raw || 'featured').trim().toLowerCase()
  if (key === 'price_asc' || key === 'price_desc' || key === 'newest' || key === 'featured') return key
  return 'featured'
}

export function encodeProductCursor(doc, sortKey = 'featured') {
  if (!doc) return null
  const id = String(doc._id || doc.id || '')
  if (!id) return null
  const payload = {
    m: 'keyset',
    s: normalizeProductSortKey(sortKey),
    f: doc.isFeatured === true || doc.is_featured === true ? 1 : 0,
    o: Number(doc.displayOrder ?? doc.display_order ?? 0) || 0,
    t: new Date(doc.createdAt || doc.created_at || 0).toISOString(),
    id,
  }
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function encodeOffsetCursor({ sort, offset }) {
  const payload = {
    m: 'offset',
    s: normalizeProductSortKey(sort),
    n: Math.max(0, Number(offset) || 0),
  }
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function isOffsetCursor(cursor) {
  if (!cursor) return false
  try {
    const raw = Buffer.from(String(cursor), 'base64url').toString('utf8')
    const parsed = JSON.parse(raw)
    return parsed?.m === 'offset'
  } catch {
    return false
  }
}

export function decodeProductCursor(cursor) {
  if (!cursor) return null
  try {
    const raw = Buffer.from(String(cursor), 'base64url').toString('utf8')
    const parsed = JSON.parse(raw)
    if (parsed?.m === 'offset') {
      return {
        mode: 'offset',
        sort: normalizeProductSortKey(parsed.s),
        offset: Math.max(0, Number(parsed.n) || 0),
      }
    }
    if (!parsed?.id || !mongoose.isValidObjectId(parsed.id)) {
      throw new AppError(422, 'INVALID_CURSOR', 'Invalid pagination cursor')
    }
    const createdAt = new Date(parsed.t)
    if (Number.isNaN(createdAt.getTime())) {
      throw new AppError(422, 'INVALID_CURSOR', 'Invalid pagination cursor')
    }
    return {
      mode: 'keyset',
      sort: normalizeProductSortKey(parsed.s),
      isFeatured: Number(parsed.f) === 1,
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
 * Keyset filter for the active product sort after the last seen document.
 * Legacy cursors without `m` still work as displayOrder/createdAt/_id.
 */
export function productCursorFilter(decoded) {
  return productCursorFilterForSort(decoded, decoded?.sort || 'featured')
}

export function productCursorFilterForSort(decoded, sortKey = 'featured') {
  if (!decoded || decoded.mode === 'offset') return null
  const { displayOrder, createdAt, id, isFeatured } = decoded
  const key = normalizeProductSortKey(sortKey || decoded.sort)

  if (key === 'newest') {
    return {
      $or: [
        { createdAt: { $lt: createdAt } },
        { createdAt, _id: { $lt: id } },
      ],
    }
  }

  // featured (default keyset): isFeatured desc, displayOrder asc, createdAt desc, _id desc
  const featured = isFeatured === true
  return {
    $or: [
      { isFeatured: { $lt: featured } },
      { isFeatured: featured, displayOrder: { $gt: displayOrder } },
      { isFeatured: featured, displayOrder, createdAt: { $lt: createdAt } },
      { isFeatured: featured, displayOrder, createdAt, _id: { $lt: id } },
    ],
  }
}
