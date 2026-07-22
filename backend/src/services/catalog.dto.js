import { AppError } from '../utils/AppError.js'
import { dubaiDayEndUtc, dubaiDayStartUtc, isYmd } from '../utils/dubaiTime.js'
import { sanitizeCmsHtml } from '../utils/htmlSanitize.js'
import { normalizePurity, resolveTaxTreatment } from '../utils/purity.js'
import { deserialize } from '../utils/serialize.js'
import { assertVariantWeights } from './address.dto.js'

const GLOBAL_BLOCKED = new Set([
  '_id', 'id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'created_by', 'updated_by',
  '__v', 'ratingAvg', 'ratingCount', 'rating_avg', 'rating_count',
  'storageKey', 'storage_key', // trusted upload path only — never from public body
])

const ALLOW = {
  categories: new Set([
    'parentId', 'name', 'nameAr', 'slug', 'description', 'descriptionAr',
    'imageUrl', 'displayOrder', 'isActive',
  ]),
  brands: new Set([
    'name', 'nameAr', 'slug', 'description', 'descriptionAr',
    'logoUrl', 'logoDesktopUrl', 'logoTabletUrl', 'logoMobileUrl',
    'bannerDesktopUrl', 'bannerTabletUrl', 'bannerMobileUrl',
    'displayOrder', 'isActive',
  ]),
  products: new Set([
    'categoryId', 'brandId', 'name', 'nameAr', 'slug', 'description', 'descriptionAr',
    'shortDescription', 'shortDescriptionAr', 'metalType', 'metalColor', 'purity', 'gender',
    'occasion', 'makingChargeType', 'makingChargeValue', 'wastagePercent', 'taxTreatment',
    'isCustomizable', 'customizationNote', 'status', 'isFeatured', 'displayOrder',
  ]),
  variants: new Set([
    'productId', 'sku', 'label', 'labelAr', 'sizeLabel', 'purity', 'jewelleryType',
    'ringSize', 'bangleSize', 'chainLengthInch', 'heightMm', 'widthMm', 'lengthMm', 'diameterMm',
    'sizeUnit', 'taxTreatment', 'weightGrams', 'effectiveWeight', 'makingCharge', 'stoneCharge',
    'fixedPrice', 'compareAtPrice', 'lowStockThreshold', 'isActive', 'metadata',
  ]),
  images: new Set(['productId', 'variantId', 'imageUrl', 'altText', 'displayOrder', 'isPrimary']),
  stones: new Set([
    'variantId', 'stoneRateId', 'label', 'stoneType', 'grade', 'unit', 'pricingMode',
    'stoneCount', 'weight', 'shape', 'sizeMm', 'settingType', 'manualCharge', 'displayOrder',
  ]),
  certificates: new Set(['productId', 'variantId', 'certNumber', 'authority', 'fileUrl', 'metadata', 'issuedDate']),
  banners: new Set([
    'position', 'title', 'titleAr', 'subtitle', 'subtitleAr', 'eyebrow', 'eyebrowAr',
    'imageUrl', 'imageUrlAr', 'mobileImageUrl', 'mobileImageUrlAr', 'ctaText', 'ctaTextAr',
    'ctaLink', 'displayOrder', 'isActive', 'startsAt', 'endsAt',
  ]),
  'cms-pages': new Set(['slug', 'title', 'titleAr', 'content', 'contentAr', 'isPublished']),
}

const VARIANT_STOCK_FIELDS = new Set(['stockQty', 'reservedQty', 'stock_qty', 'reserved_qty'])
const RESERVED_VARIANT_META = new Set([
  'idempotencyKey', 'idempotency_key',
  'lastUpdateIdempotencyKey', 'last_update_idempotency_key',
  'lastUpdateRequestHash', 'last_update_request_hash',
  'createRequestHash', 'create_request_hash',
])

const MAX_META_KEYS = 40
const MAX_META_DEPTH = 1

function assertSafeMetadata(value, { allowReserved = false } = {}) {
  if (value == null) return {}
  if (typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new AppError(422, 'VALIDATION_ERROR', 'metadata must be a plain object')
  }
  const keys = Object.keys(value)
  if (keys.length > MAX_META_KEYS) {
    throw new AppError(422, 'VALIDATION_ERROR', `metadata may have at most ${MAX_META_KEYS} keys`)
  }
  const out = {}
  for (const key of keys) {
    if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new AppError(422, 'VALIDATION_ERROR', `metadata key "${key}" is not allowed`)
    }
    if (!allowReserved && RESERVED_VARIANT_META.has(key)) {
      throw new AppError(422, 'RESERVED_METADATA', `metadata.${key} is reserved and cannot be set by clients`)
    }
    const v = value[key]
    if (v != null && typeof v === 'object') {
      throw new AppError(422, 'VALIDATION_ERROR', `metadata nesting deeper than ${MAX_META_DEPTH} is not allowed`)
    }
    if (typeof v === 'string' && v.length > 500) {
      throw new AppError(422, 'VALIDATION_ERROR', 'metadata string values must be ≤ 500 characters')
    }
    out[key] = v
  }
  return out
}

function parseDubaiYmdField(value, { endOfDay = false } = {}) {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid date')
    return value
  }
  const raw = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    // Accept ISO only when it already encodes an instant; prefer YMD for calendar fields.
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid date')
    return d
  }
  if (!isYmd(raw)) throw new AppError(422, 'VALIDATION_ERROR', 'Date must be YYYY-MM-DD')
  return endOfDay ? dubaiDayEndUtc(raw) : dubaiDayStartUtc(raw)
}

function normalizeSlug(slug) {
  return String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}

/**
 * Allowlist catalog write payloads. Strips ownership/audit/stock privileged fields.
 */
export function toCatalogWriteDto(resource, payload, { partial = false } = {}) {
  const allowed = ALLOW[resource]
  if (!allowed) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Catalog resource not found')

  const source = deserialize(payload || {})
  for (const key of Object.keys(source)) {
    if (GLOBAL_BLOCKED.has(key) || VARIANT_STOCK_FIELDS.has(key)) delete source[key]
  }

  // Reject legacy CMS body alias — content is canonical
  if (resource === 'cms-pages') {
    if ('body' in (payload || {}) || 'body_ar' in (payload || {}) || 'bodyAr' in source) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Use content / content_ar (body is not accepted)')
    }
  }
  if (resource === 'banners') {
    if ('link_url' in (payload || {}) || 'linkUrl' in source) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Use cta_link (link_url is not accepted)')
    }
  }
  if (resource === 'certificates') {
    if ('certificate_number' in (payload || {}) || 'issuer' in (payload || {}) || 'issued_at' in (payload || {})) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Use cert_number, authority, issued_date')
    }
  }

  const dto = {}
  for (const [key, value] of Object.entries(source)) {
    if (allowed.has(key)) dto[key] = value
  }

  if (resource === 'products' && source.occasions != null && dto.occasion == null) {
    dto.occasion = source.occasions
  }

  if (!partial && resource === 'variants') {
    assertVariantWeights(dto)
  }

  if (dto.purity != null && dto.purity !== '') {
    dto.purity = normalizePurity(dto.purity)
  }

  if (resource === 'products' || resource === 'variants') {
    if (dto.purity != null || (dto.taxTreatment != null && dto.taxTreatment !== '')) {
      dto.taxTreatment = resolveTaxTreatment(dto.purity, dto.taxTreatment)
    }
  } else if (dto.taxTreatment != null && dto.taxTreatment !== '') {
    dto.taxTreatment = resolveTaxTreatment(dto.purity, dto.taxTreatment)
  }

  if (resource === 'banners') {
    if ('startsAt' in dto) dto.startsAt = parseDubaiYmdField(dto.startsAt, { endOfDay: false })
    if ('endsAt' in dto) dto.endsAt = parseDubaiYmdField(dto.endsAt, { endOfDay: true })
    if (dto.startsAt && dto.endsAt && dto.startsAt.getTime() > dto.endsAt.getTime()) {
      throw new AppError(422, 'VALIDATION_ERROR', 'starts_at must not be later than ends_at')
    }
    if (dto.imageUrl && (dto.imageUrl.includes('..') || dto.imageUrl.startsWith('/'))) {
      if (!/^https?:\/\//i.test(dto.imageUrl) && !dto.imageUrl.startsWith('/uploads/') && !dto.imageUrl.startsWith('/media/')) {
        throw new AppError(422, 'VALIDATION_ERROR', 'image_url must be a public URL')
      }
    }
  }

  if (resource === 'certificates') {
    if ('issuedDate' in dto) dto.issuedDate = parseDubaiYmdField(dto.issuedDate, { endOfDay: false })
    if ('metadata' in dto) dto.metadata = assertSafeMetadata(dto.metadata)
  }

  if (resource === 'variants' && 'metadata' in dto) {
    dto.metadata = assertSafeMetadata(dto.metadata)
  }

  if (resource === 'cms-pages') {
    if ('slug' in dto) {
      dto.slug = normalizeSlug(dto.slug)
      if (!dto.slug) throw new AppError(422, 'VALIDATION_ERROR', 'slug is required')
    }
    if ('content' in dto) dto.content = sanitizeCmsHtml(dto.content)
    if ('contentAr' in dto) dto.contentAr = dto.contentAr == null ? null : sanitizeCmsHtml(dto.contentAr)
  }

  if (resource === 'images') {
    if (dto.imageUrl && (dto.imageUrl.startsWith('file:') || dto.imageUrl.includes('..\\') || dto.imageUrl.match(/^[A-Za-z]:\\/))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'image_url must not be a local filesystem path')
    }
  }

  return dto
}

export function assertCatalogWriteNotEmpty(dto) {
  if (!Object.keys(dto).length) {
    throw new AppError(422, 'EMPTY_PAYLOAD', 'No allowed fields to write')
  }
  return dto
}

export { normalizeSlug, assertSafeMetadata, parseDubaiYmdField }
