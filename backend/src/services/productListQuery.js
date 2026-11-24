import mongoose from 'mongoose'
import { Product, ProductStone, Variant } from '../models/catalog.models.js'
import {
  decodeProductCursor,
  encodeOffsetCursor,
  encodeProductCursor,
  isOffsetCursor,
  productCursorFilterForSort,
  resolveProductListSort,
} from '../utils/cursorPagination.js'
import { getListingPriceTotals } from './pricing.service.js'

function parseCsv(value) {
  if (value == null || value === '' || value === 'all') return []
  if (Array.isArray(value)) {
    return value.flatMap((entry) => parseCsv(entry))
  }
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function parseSizeKey(key) {
  const raw = String(key || '')
  const idx = raw.indexOf(':')
  if (idx <= 0) return null
  const sizeType = raw.slice(0, idx).trim()
  const size = raw.slice(idx + 1).trim()
  if (!sizeType || !size) return null
  return { sizeType, size }
}

function sizeMatchClause({ sizeType, size }) {
  const numeric = Number(size)
  const sizeValues = [{ sizeLabel: size }, { ringSize: size }, { bangleSize: size }]
  if (Number.isFinite(numeric)) {
    sizeValues.push({ chainLengthInch: numeric })
  }
  return {
    $and: [
      {
        $or: [
          { jewelleryType: sizeType },
          { jewelleryType: sizeType.toLowerCase() },
          { jewelleryType: sizeType.toUpperCase() },
        ],
      },
      { $or: sizeValues },
    ],
  }
}

/**
 * Restrict product filter to IDs matching variant/stone constraints (size, weight, stone).
 */
export async function applyVariantDerivedProductFilters(filter, mapped = {}, { admin = false } = {}) {
  const sizes = parseCsv(mapped.size || mapped.sizes)
  const stoneTypes = parseCsv(mapped.stoneType || mapped.stoneTypes)
  const minWeight = mapped.minWeight != null && mapped.minWeight !== '' ? Number(mapped.minWeight) : null
  const maxWeight = mapped.maxWeight != null && mapped.maxWeight !== '' ? Number(mapped.maxWeight) : null

  const needsVariant = sizes.length > 0
    || stoneTypes.length > 0
    || (Number.isFinite(minWeight) && minWeight != null)
    || (Number.isFinite(maxWeight) && maxWeight != null)

  if (!needsVariant) return filter

  const variantFilter = {
    ...(admin ? {} : { isActive: true }),
  }

  if (Number.isFinite(minWeight) || Number.isFinite(maxWeight)) {
    variantFilter.weightGrams = {}
    if (Number.isFinite(minWeight)) variantFilter.weightGrams.$gte = minWeight
    if (Number.isFinite(maxWeight)) variantFilter.weightGrams.$lte = maxWeight
  }

  if (sizes.length) {
    const sizeClauses = sizes.map(parseSizeKey).filter(Boolean).map(sizeMatchClause)
    if (!sizeClauses.length) {
      filter._id = { $in: [] }
      return filter
    }
    variantFilter.$and = [...(variantFilter.$and || []), { $or: sizeClauses }]
  }

  let variantProductIds = await Variant.distinct('productId', variantFilter)

  if (stoneTypes.length) {
    const normalizedStones = stoneTypes.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
    if (!normalizedStones.length) {
      filter._id = { $in: [] }
      return filter
    }
    const stoneVariantIds = await ProductStone.distinct('variantId', {
      stoneType: {
        $in: [
          ...normalizedStones,
          ...normalizedStones.map((s) => s.toUpperCase()),
          ...stoneTypes,
        ],
      },
    })
    const stoneProductIds = stoneVariantIds.length
      ? await Variant.distinct('productId', {
        _id: { $in: stoneVariantIds },
        ...(admin ? {} : { isActive: true }),
      })
      : []
    const stoneSet = new Set(stoneProductIds.map((id) => String(id)))
    variantProductIds = variantProductIds.filter((id) => stoneSet.has(String(id)))
  }

  const ids = variantProductIds.map((id) => (
    id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id))
  ))
  filter._id = filter._id
    ? { $in: intersectObjectIds(filter._id, ids) }
    : { $in: ids }
  return filter
}

function intersectObjectIds(existing, ids) {
  if (existing?.$in) {
    const allowed = new Set(ids.map((id) => String(id)))
    return existing.$in.filter((id) => allowed.has(String(id)))
  }
  const allowed = new Set(ids.map((id) => String(id)))
  return allowed.has(String(existing)) ? [existing] : []
}

export function applyProductFieldFilters(filter, mapped = {}) {
  const genders = parseCsv(mapped.gender || mapped.genders)
  if (genders.length) {
    const expanded = new Set()
    for (const gender of genders) {
      const g = String(gender).toLowerCase()
      expanded.add(g)
      if (g === 'female') expanded.add('women')
      if (g === 'male') expanded.add('men')
      if (g === 'kids') {
        expanded.add('boys')
        expanded.add('girls')
        expanded.add('infant')
      }
    }
    filter.gender = { $in: [...expanded] }
  }

  const occasions = parseCsv(mapped.occasion || mapped.occasions)
  if (occasions.length) {
    filter.occasion = { $in: occasions }
  }

  return filter
}

function productMinPrice(variantIds, priceByVariantId) {
  let min = null
  for (const id of variantIds) {
    const total = priceByVariantId.get(String(id))
    if (total == null || Number.isNaN(Number(total))) continue
    const n = Number(total)
    if (min == null || n < min) min = n
  }
  return min
}

/**
 * When price filters or price sort are active, resolve ordered product docs via live listing totals.
 */
export async function listProductsPriceAware({
  filter,
  mapped,
  admin,
  page,
  limit,
  skip,
  sortKey,
}) {
  const minPrice = mapped.minPrice != null && mapped.minPrice !== '' ? Number(mapped.minPrice) : null
  const maxPrice = mapped.maxPrice != null && mapped.maxPrice !== '' ? Number(mapped.maxPrice) : null
  const usePriceFilter = Number.isFinite(minPrice) || Number.isFinite(maxPrice)
  const usePriceSort = sortKey === 'price_asc' || sortKey === 'price_desc'

  const candidates = await Product.find(filter).select('_id').lean()
  const productIds = candidates.map((row) => row._id)
  if (!productIds.length) {
    return {
      rows: [],
      total: 0,
      nextCursor: null,
      hasMore: false,
    }
  }

  const variants = await Variant.find({
    productId: { $in: productIds },
    ...(admin ? {} : { isActive: true }),
  }).select('_id productId').lean()

  const variantsByProduct = new Map()
  for (const variant of variants) {
    const key = String(variant.productId)
    if (!variantsByProduct.has(key)) variantsByProduct.set(key, [])
    variantsByProduct.get(key).push(String(variant._id))
  }

  const allVariantIds = variants.map((v) => String(v._id))
  const priceRows = allVariantIds.length ? await getListingPriceTotals(allVariantIds) : []
  const priceByVariantId = new Map(priceRows.map((row) => [String(row.variant_id), row.total]))

  let ranked = productIds.map((id) => {
    const key = String(id)
    const min = productMinPrice(variantsByProduct.get(key) || [], priceByVariantId)
    return { id, minPrice: min }
  })

  if (usePriceFilter) {
    ranked = ranked.filter((row) => {
      // Missing prices never pass a price filter (storefront correctness).
      if (row.minPrice == null) return false
      if (Number.isFinite(minPrice) && row.minPrice < minPrice) return false
      if (Number.isFinite(maxPrice) && row.minPrice > maxPrice) return false
      return true
    })
  }

  if (usePriceSort) {
    ranked.sort((a, b) => {
      const av = a.minPrice == null ? Number.POSITIVE_INFINITY : a.minPrice
      const bv = b.minPrice == null ? Number.POSITIVE_INFINITY : b.minPrice
      if (av !== bv) return sortKey === 'price_asc' ? av - bv : bv - av
      return String(a.id).localeCompare(String(b.id))
    })
  } else {
    // Keep mongo-ish featured/newest order by refetching sorted ids among survivors.
    const sort = resolveProductListSort(sortKey)
    const ordered = await Product.find({ _id: { $in: ranked.map((r) => r.id) } })
      .sort(sort)
      .select('_id')
      .lean()
    const priceMap = new Map(ranked.map((r) => [String(r.id), r.minPrice]))
    ranked = ordered.map((row) => ({ id: row._id, minPrice: priceMap.get(String(row._id)) ?? null }))
  }

  const total = ranked.length

  let offset = skip
  if (mapped.cursor && isOffsetCursor(mapped.cursor)) {
    const decoded = decodeProductCursor(mapped.cursor)
    offset = Number(decoded?.offset) || 0
  }

  const pageIds = ranked.slice(offset, offset + limit).map((row) => row.id)
  const rowsUnordered = pageIds.length
    ? await Product.find({ _id: { $in: pageIds } }).lean()
    : []
  const byId = new Map(rowsUnordered.map((row) => [String(row._id), row]))
  const rows = pageIds.map((id) => byId.get(String(id))).filter(Boolean)
  const nextOffset = offset + rows.length
  const hasMore = nextOffset < total
  const nextCursor = hasMore
    ? encodeOffsetCursor({ sort: sortKey, offset: nextOffset })
    : null

  return { rows, total, nextCursor, hasMore, page: Math.floor(offset / limit) + 1 }
}

export function needsPriceAwareList(mapped = {}, sortKey) {
  const minPrice = mapped.minPrice != null && mapped.minPrice !== '' ? Number(mapped.minPrice) : null
  const maxPrice = mapped.maxPrice != null && mapped.maxPrice !== '' ? Number(mapped.maxPrice) : null
  return (
    Number.isFinite(minPrice)
    || Number.isFinite(maxPrice)
    || sortKey === 'price_asc'
    || sortKey === 'price_desc'
  )
}

export function buildKeysetCursorState(mapped, sortKey, { useCursor, skip, limit, rowsRaw, total }) {
  let rows = rowsRaw
  let nextCursor = null
  let hasMore = false

  if (useCursor) {
    hasMore = rowsRaw.length > limit
    rows = hasMore ? rowsRaw.slice(0, limit) : rowsRaw
    const last = rows[rows.length - 1]
    nextCursor = hasMore ? encodeProductCursor(last, sortKey) : null
  } else if (rows.length) {
    const last = rows[rows.length - 1]
    const pageHasMore = skip + rows.length < total
    nextCursor = pageHasMore ? encodeProductCursor(last, sortKey) : null
    hasMore = pageHasMore
  }

  return { rows, nextCursor, hasMore }
}

export function resolveCursorFilter(mapped, sortKey) {
  if (!mapped.cursor) return null
  if (isOffsetCursor(mapped.cursor)) return null
  return productCursorFilterForSort(decodeProductCursor(mapped.cursor), sortKey)
}
