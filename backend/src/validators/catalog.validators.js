import { z } from 'zod'
import { catalogResourceEnum, objectId } from './common.schemas.js'
import { resolveFieldAlias } from './alias.js'
import { finiteNumber, optionalFiniteNumber } from './numeric.js'

const purityEnum = z.enum(['14k', '18k', '21k', '22k', '24k', '14K', '18K', '21K', '22K', '24K', '14KT', '18KT', '21KT', '22KT', '24KT'])
const taxTreatmentEnum = z.enum(['standard', 'zero_rated', 'exempt', 'investment_precious_metal_zero_rated'])
const metalTypeEnum = z.enum(['gold', 'diamond', 'gold_diamond', 'silver'])
const genderEnum = z.enum(['unisex', 'male', 'female', 'boys', 'girls', 'infant', 'kids'])
const makingChargeTypeEnum = z.enum(['percent', 'flat'])
const productStatusEnum = z.enum(['draft', 'active', 'archived'])
const nullableObjectId = objectId.nullable()
const optionalUrl = z.string().trim().max(2048).nullable().optional()

function rejectEmptyPatch(schema) {
  return schema.superRefine((body, ctx) => {
    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required', path: [] })
    }
  })
}

/** Reject conflicting snake_case / camelCase dual values. */
function rejectAliasConflicts(pairs) {
  return (body, ctx) => {
    for (const [snake, camel] of pairs) {
      try {
        resolveFieldAlias(body, snake, camel)
      } catch (error) {
        if (error instanceof z.ZodError) {
          for (const issue of error.issues) ctx.addIssue(issue)
        } else {
          throw error
        }
      }
    }
  }
}

const PRODUCT_ALIAS_PAIRS = [
  ['name_ar', 'nameAr'],
  ['brand_id', 'brandId'],
  ['category_id', 'categoryId'],
  ['description_ar', 'descriptionAr'],
  ['short_description', 'shortDescription'],
  ['short_description_ar', 'shortDescriptionAr'],
  ['metal_type', 'metalType'],
  ['metal_color', 'metalColor'],
  ['making_charge_type', 'makingChargeType'],
  ['making_charge_value', 'makingChargeValue'],
  ['wastage_percent', 'wastagePercent'],
  ['tax_treatment', 'taxTreatment'],
  ['display_order', 'displayOrder'],
  ['is_featured', 'isFeatured'],
  ['is_customizable', 'isCustomizable'],
  ['customization_note', 'customizationNote'],
  ['occasion', 'occasions'],
]

const CATEGORY_ALIAS_PAIRS = [
  ['name_ar', 'nameAr'],
  ['description_ar', 'descriptionAr'],
  ['parent_id', 'parentId'],
  ['image_url', 'imageUrl'],
  ['display_order', 'displayOrder'],
  ['is_active', 'isActive'],
]

const BRAND_ALIAS_PAIRS = [
  ['name_ar', 'nameAr'],
  ['description_ar', 'descriptionAr'],
  ['logo_url', 'logoUrl'],
  ['logo_desktop_url', 'logoDesktopUrl'],
  ['logo_tablet_url', 'logoTabletUrl'],
  ['logo_mobile_url', 'logoMobileUrl'],
  ['banner_desktop_url', 'bannerDesktopUrl'],
  ['banner_tablet_url', 'bannerTabletUrl'],
  ['banner_mobile_url', 'bannerMobileUrl'],
  ['display_order', 'displayOrder'],
  ['is_active', 'isActive'],
]

const STONE_ALIAS_PAIRS = [
  ['stone_rate_id', 'stoneRateId'],
  ['stone_type', 'stoneType'],
  ['stone_count', 'stoneCount'],
  ['pricing_mode', 'pricingMode'],
  ['size_mm', 'sizeMm'],
  ['setting_type', 'settingType'],
  ['manual_charge', 'manualCharge'],
  ['display_order', 'displayOrder'],
]

const VARIANT_ALIAS_PAIRS = [
  ['product_id', 'productId'],
  ['label_ar', 'labelAr'],
  ['size_label', 'sizeLabel'],
  ['jewellery_type', 'jewelleryType'],
  ['ring_size', 'ringSize'],
  ['bangle_size', 'bangleSize'],
  ['chain_length_inch', 'chainLengthInch'],
  ['height_mm', 'heightMm'],
  ['width_mm', 'widthMm'],
  ['length_mm', 'lengthMm'],
  ['diameter_mm', 'diameterMm'],
  ['size_unit', 'sizeUnit'],
  ['tax_treatment', 'taxTreatment'],
  ['weight_grams', 'weightGrams'],
  ['effective_weight', 'effectiveWeight'],
  ['making_charge', 'makingCharge'],
  ['stone_charge', 'stoneCharge'],
  ['fixed_price', 'fixedPrice'],
  ['compare_at_price', 'compareAtPrice'],
  ['low_stock_threshold', 'lowStockThreshold'],
  ['is_active', 'isActive'],
]

const RESERVED_VARIANT_METADATA_KEYS = new Set([
  'idempotencyKey', 'idempotency_key',
  'lastUpdateIdempotencyKey', 'last_update_idempotency_key',
  'lastUpdateRequestHash', 'last_update_request_hash',
  'createRequestHash', 'create_request_hash',
])

function rejectReservedMetadata(body, ctx) {
  const meta = body?.metadata
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return
  for (const key of Object.keys(meta)) {
    if (RESERVED_VARIANT_METADATA_KEYS.has(key)) {
      ctx.addIssue({
        code: 'custom',
        message: `metadata.${key} is reserved and cannot be set by clients`,
        path: ['metadata', key],
      })
    }
  }
}

/** Canonical product-stone write schema (Phase 22.8). */
export const stoneSchema = z.object({
  stone_rate_id: objectId.nullable().optional(),
  stoneRateId: objectId.nullable().optional(),
  label: z.string().trim().max(120).nullable().optional(),
  stone_type: z.string().trim().min(1).max(120).optional(),
  stoneType: z.string().trim().min(1).max(120).optional(),
  grade: z.string().trim().max(80).nullable().optional(),
  unit: z.enum(['carat', 'piece']).optional(),
  pricing_mode: z.enum(['rate', 'fixed']).optional(),
  pricingMode: z.enum(['rate', 'fixed']).optional(),
  stone_count: finiteNumber(z.number().int().positive().max(10_000)).optional(),
  stoneCount: finiteNumber(z.number().int().positive().max(10_000)).optional(),
  weight: optionalFiniteNumber(z.number().finite().positive().max(1_000_000)),
  shape: z.string().trim().max(80).nullable().optional(),
  size_mm: optionalFiniteNumber(z.number().finite().min(0).max(10_000)),
  sizeMm: optionalFiniteNumber(z.number().finite().min(0).max(10_000)),
  setting_type: z.string().trim().max(80).nullable().optional(),
  settingType: z.string().trim().max(80).nullable().optional(),
  manual_charge: optionalFiniteNumber(z.number().finite().min(0).max(10_000_000)),
  manualCharge: optionalFiniteNumber(z.number().finite().min(0).max(10_000_000)),
  display_order: optionalFiniteNumber(z.number().int().min(0).max(10_000)),
  displayOrder: optionalFiniteNumber(z.number().int().min(0).max(10_000)),
}).strict().superRefine((row, ctx) => {
  rejectAliasConflicts(STONE_ALIAS_PAIRS)(row, ctx)

  const rateId = row.stone_rate_id !== undefined ? row.stone_rate_id : row.stoneRateId
  const manual = row.manual_charge !== undefined ? row.manual_charge : row.manualCharge
  let mode = row.pricing_mode || row.pricingMode
  if (!mode) {
    if (rateId) mode = 'rate'
    else if (manual != null) mode = 'fixed'
    else mode = 'rate'
  }

  if (mode === 'rate') {
    if (!rateId) {
      ctx.addIssue({ code: 'custom', message: 'stone_rate_id is required when pricing_mode=rate', path: ['stone_rate_id'] })
    }
  } else {
    if (rateId) {
      ctx.addIssue({ code: 'custom', message: 'stone_rate_id must be null when pricing_mode=fixed', path: ['stone_rate_id'] })
    }
    if (manual == null || !Number.isFinite(Number(manual)) || Number(manual) < 0) {
      ctx.addIssue({ code: 'custom', message: 'manual_charge is required (complete line charge, AED ≥ 0) when pricing_mode=fixed', path: ['manual_charge'] })
    }
  }

  if (mode === 'fixed' && !(row.stone_type || row.stoneType || row.label)) {
    ctx.addIssue({ code: 'custom', message: 'stone_type or label is required for fixed stones', path: ['stone_type'] })
  }

  const unit = row.unit === 'carat' ? 'carat' : (row.unit === 'piece' ? 'piece' : null)
  // unit may come from rate on server; if provided, enforce weight/count
  if (unit === 'carat') {
    const weight = row.weight
    if (weight == null || !(Number(weight) > 0) || !Number.isFinite(Number(weight))) {
      ctx.addIssue({ code: 'custom', message: 'carat stones require weight > 0', path: ['weight'] })
    }
  } else if (unit === 'piece' || mode === 'fixed') {
    const count = row.stone_count ?? row.stoneCount
    if (count != null && (!(Number(count) >= 1) || !Number.isInteger(Number(count)))) {
      ctx.addIssue({ code: 'custom', message: 'piece stones require stone_count >= 1', path: ['stone_count'] })
    }
    if (unit === 'piece' && (count == null || !(Number(count) >= 1))) {
      ctx.addIssue({ code: 'custom', message: 'piece stones require stone_count >= 1', path: ['stone_count'] })
    }
  }
})

const stoneWriteBody = stoneSchema

const variantFields = {
  product_id: objectId.optional(),
  productId: objectId.optional(),
  sku: z.string().trim().min(1).max(120).optional(),
  label: z.string().trim().max(200).optional(),
  label_ar: z.string().trim().max(200).nullable().optional(),
  labelAr: z.string().trim().max(200).nullable().optional(),
  size_label: z.string().trim().max(80).nullable().optional(),
  sizeLabel: z.string().trim().max(80).nullable().optional(),
  purity: purityEnum.optional(),
  jewellery_type: z.string().trim().max(80).nullable().optional(),
  jewelleryType: z.string().trim().max(80).nullable().optional(),
  ring_size: z.union([z.string().trim().max(40), finiteNumber(z.number())]).nullable().optional(),
  ringSize: z.union([z.string().trim().max(40), finiteNumber(z.number())]).nullable().optional(),
  bangle_size: z.union([z.string().trim().max(40), finiteNumber(z.number())]).nullable().optional(),
  bangleSize: z.union([z.string().trim().max(40), finiteNumber(z.number())]).nullable().optional(),
  chain_length_inch: optionalFiniteNumber(z.number().finite().min(0)),
  chainLengthInch: optionalFiniteNumber(z.number().finite().min(0)),
  height_mm: optionalFiniteNumber(z.number().finite().min(0)),
  heightMm: optionalFiniteNumber(z.number().finite().min(0)),
  width_mm: optionalFiniteNumber(z.number().finite().min(0)),
  widthMm: optionalFiniteNumber(z.number().finite().min(0)),
  length_mm: optionalFiniteNumber(z.number().finite().min(0)),
  lengthMm: optionalFiniteNumber(z.number().finite().min(0)),
  diameter_mm: optionalFiniteNumber(z.number().finite().min(0)),
  diameterMm: optionalFiniteNumber(z.number().finite().min(0)),
  size_unit: z.string().trim().max(20).nullable().optional(),
  sizeUnit: z.string().trim().max(20).nullable().optional(),
  tax_treatment: taxTreatmentEnum.optional(),
  taxTreatment: taxTreatmentEnum.optional(),
  weight_grams: optionalFiniteNumber(z.number().finite().positive().max(1_000_000)),
  weightGrams: optionalFiniteNumber(z.number().finite().positive().max(1_000_000)),
  effective_weight: optionalFiniteNumber(z.number().finite().min(0).max(1_000_000)),
  effectiveWeight: optionalFiniteNumber(z.number().finite().min(0).max(1_000_000)),
  making_charge: optionalFiniteNumber(z.number().finite().min(0)),
  makingCharge: optionalFiniteNumber(z.number().finite().min(0)),
  stone_charge: optionalFiniteNumber(z.number().finite().min(0)),
  stoneCharge: optionalFiniteNumber(z.number().finite().min(0)),
  fixed_price: optionalFiniteNumber(z.number().finite().min(0)),
  fixedPrice: optionalFiniteNumber(z.number().finite().min(0)),
  compare_at_price: optionalFiniteNumber(z.number().finite().min(0)),
  compareAtPrice: optionalFiniteNumber(z.number().finite().min(0)),
  low_stock_threshold: optionalFiniteNumber(z.number().int().min(0)),
  lowStockThreshold: optionalFiniteNumber(z.number().int().min(0)),
  is_active: z.boolean().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
}

const variantBody = z.object({ ...variantFields }).strict().superRefine((body, ctx) => {
  rejectAliasConflicts(VARIANT_ALIAS_PAIRS)(body, ctx)
  rejectReservedMetadata(body, ctx)
})


const productBody = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  name_ar: z.string().trim().max(300).nullable().optional(),
  nameAr: z.string().trim().max(300).nullable().optional(),
  slug: z.string().trim().min(1).max(200).optional(),
  brand_id: nullableObjectId.optional(),
  brandId: nullableObjectId.optional(),
  category_id: nullableObjectId.optional(),
  categoryId: nullableObjectId.optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
  description_ar: z.string().trim().max(10_000).nullable().optional(),
  descriptionAr: z.string().trim().max(10_000).nullable().optional(),
  short_description: z.string().trim().max(2000).nullable().optional(),
  shortDescription: z.string().trim().max(2000).nullable().optional(),
  short_description_ar: z.string().trim().max(2000).nullable().optional(),
  shortDescriptionAr: z.string().trim().max(2000).nullable().optional(),
  metal_type: metalTypeEnum.optional(),
  metalType: metalTypeEnum.optional(),
  metal_color: z.string().trim().max(40).nullable().optional(),
  metalColor: z.string().trim().max(40).nullable().optional(),
  purity: purityEnum.nullable().optional(),
  gender: genderEnum.optional(),
  occasion: z.array(z.string().trim().max(80)).max(50).optional(),
  occasions: z.array(z.string().trim().max(80)).max(50).optional(),
  making_charge_type: makingChargeTypeEnum.optional(),
  makingChargeType: makingChargeTypeEnum.optional(),
  making_charge_value: z.coerce.number().finite().min(0).max(1_000_000).optional(),
  makingChargeValue: z.coerce.number().finite().min(0).max(1_000_000).optional(),
  wastage_percent: z.coerce.number().finite().min(0).max(100).optional(),
  wastagePercent: z.coerce.number().finite().min(0).max(100).optional(),
  tax_treatment: taxTreatmentEnum.optional(),
  taxTreatment: taxTreatmentEnum.optional(),
  status: productStatusEnum.optional(),
  is_featured: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  display_order: z.coerce.number().int().min(0).max(10_000).optional(),
  displayOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  is_customizable: z.boolean().optional(),
  isCustomizable: z.boolean().optional(),
  customization_note: z.string().trim().max(2000).nullable().optional(),
  customizationNote: z.string().trim().max(2000).nullable().optional(),
}).strict().superRefine(rejectAliasConflicts(PRODUCT_ALIAS_PAIRS))

const categoryBody = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  name_ar: z.string().trim().max(200).nullable().optional(),
  nameAr: z.string().trim().max(200).nullable().optional(),
  slug: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
  description_ar: z.string().trim().max(10_000).nullable().optional(),
  descriptionAr: z.string().trim().max(10_000).nullable().optional(),
  parent_id: nullableObjectId.optional(),
  parentId: nullableObjectId.optional(),
  image_url: optionalUrl,
  imageUrl: optionalUrl,
  display_order: z.coerce.number().int().min(0).max(10_000).optional(),
  displayOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  is_active: z.boolean().optional(),
  isActive: z.boolean().optional(),
}).strict().superRefine(rejectAliasConflicts(CATEGORY_ALIAS_PAIRS))

const brandBody = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  name_ar: z.string().trim().max(200).nullable().optional(),
  nameAr: z.string().trim().max(200).nullable().optional(),
  slug: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
  description_ar: z.string().trim().max(10_000).nullable().optional(),
  descriptionAr: z.string().trim().max(10_000).nullable().optional(),
  logo_url: optionalUrl,
  logoUrl: optionalUrl,
  logo_desktop_url: optionalUrl,
  logoDesktopUrl: optionalUrl,
  logo_tablet_url: optionalUrl,
  logoTabletUrl: optionalUrl,
  logo_mobile_url: optionalUrl,
  logoMobileUrl: optionalUrl,
  banner_desktop_url: optionalUrl,
  bannerDesktopUrl: optionalUrl,
  banner_tablet_url: optionalUrl,
  bannerTabletUrl: optionalUrl,
  banner_mobile_url: optionalUrl,
  bannerMobileUrl: optionalUrl,
  display_order: z.coerce.number().int().min(0).max(10_000).optional(),
  displayOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  is_active: z.boolean().optional(),
  isActive: z.boolean().optional(),
}).strict().superRefine(rejectAliasConflicts(BRAND_ALIAS_PAIRS))

const BANNER_POSITIONS = z.enum([
  'hero', 'strip', 'collection', 'promo_top', 'deal', 'gifting', 'promo_bottom',
])

/** Strict non-negative int — no silent coerce of empty/NaN strings. */
const nonNegInt = z.number({ errorMap: () => ({ message: 'must be a finite non-negative integer' }) })
  .finite()
  .int()
  .min(0)
  .max(10_000)

const ymdOrNull = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD'),
  z.null(),
]).optional()

const IMAGE_ALIAS_PAIRS = [
  ['product_id', 'productId'],
  ['variant_id', 'variantId'],
  ['image_url', 'imageUrl'],
  ['alt_text', 'altText'],
  ['is_primary', 'isPrimary'],
  ['display_order', 'displayOrder'],
]

const CERT_ALIAS_PAIRS = [
  ['product_id', 'productId'],
  ['variant_id', 'variantId'],
  ['cert_number', 'certNumber'],
  ['issued_date', 'issuedDate'],
  ['file_url', 'fileUrl'],
]

const BANNER_ALIAS_PAIRS = [
  ['title_ar', 'titleAr'],
  ['subtitle_ar', 'subtitleAr'],
  ['eyebrow_ar', 'eyebrowAr'],
  ['image_url', 'imageUrl'],
  ['image_url_ar', 'imageUrlAr'],
  ['mobile_image_url', 'mobileImageUrl'],
  ['mobile_image_url_ar', 'mobileImageUrlAr'],
  ['cta_text', 'ctaText'],
  ['cta_text_ar', 'ctaTextAr'],
  ['cta_link', 'ctaLink'],
  ['display_order', 'displayOrder'],
  ['is_active', 'isActive'],
  ['starts_at', 'startsAt'],
  ['ends_at', 'endsAt'],
]

const CMS_ALIAS_PAIRS = [
  ['title_ar', 'titleAr'],
  ['content_ar', 'contentAr'],
  ['is_published', 'isPublished'],
]

const imageBody = z.object({
  product_id: objectId.optional(),
  productId: objectId.optional(),
  variant_id: objectId.nullable().optional(),
  variantId: objectId.nullable().optional(),
  image_url: z.string().trim().min(1).max(2048).optional(),
  imageUrl: z.string().trim().min(1).max(2048).optional(),
  alt_text: z.string().trim().max(300).nullable().optional(),
  altText: z.string().trim().max(300).nullable().optional(),
  is_primary: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  display_order: nonNegInt.optional(),
  displayOrder: nonNegInt.optional(),
}).strict().superRefine(rejectAliasConflicts(IMAGE_ALIAS_PAIRS))

const certificateBody = z.object({
  product_id: objectId.optional(),
  productId: objectId.optional(),
  variant_id: objectId.nullable().optional(),
  variantId: objectId.nullable().optional(),
  cert_number: z.string().trim().min(1).max(120).optional(),
  certNumber: z.string().trim().min(1).max(120).optional(),
  authority: z.string().trim().min(1).max(200).optional(),
  issued_date: ymdOrNull,
  issuedDate: ymdOrNull,
  metadata: z.record(z.string().max(80), z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).optional(),
  file_url: z.string().trim().max(2048).nullable().optional(),
  fileUrl: z.string().trim().max(2048).nullable().optional(),
}).strict().superRefine(rejectAliasConflicts(CERT_ALIAS_PAIRS))

const bannerBody = z.object({
  position: BANNER_POSITIONS.optional(),
  title: z.string().trim().max(200).optional(),
  title_ar: z.string().trim().max(200).nullable().optional(),
  titleAr: z.string().trim().max(200).nullable().optional(),
  subtitle: z.string().trim().max(500).nullable().optional(),
  subtitle_ar: z.string().trim().max(500).nullable().optional(),
  subtitleAr: z.string().trim().max(500).nullable().optional(),
  eyebrow: z.string().trim().max(200).nullable().optional(),
  eyebrow_ar: z.string().trim().max(200).nullable().optional(),
  eyebrowAr: z.string().trim().max(200).nullable().optional(),
  image_url: z.string().trim().max(2048).optional(),
  imageUrl: z.string().trim().max(2048).optional(),
  image_url_ar: z.string().trim().max(2048).nullable().optional(),
  imageUrlAr: z.string().trim().max(2048).nullable().optional(),
  mobile_image_url: z.string().trim().max(2048).optional(),
  mobileImageUrl: z.string().trim().max(2048).optional(),
  mobile_image_url_ar: z.string().trim().max(2048).nullable().optional(),
  mobileImageUrlAr: z.string().trim().max(2048).nullable().optional(),
  cta_text: z.string().trim().max(120).nullable().optional(),
  ctaText: z.string().trim().max(120).nullable().optional(),
  cta_text_ar: z.string().trim().max(120).nullable().optional(),
  ctaTextAr: z.string().trim().max(120).nullable().optional(),
  cta_link: z.string().trim().max(2048).nullable().optional(),
  ctaLink: z.string().trim().max(2048).nullable().optional(),
  display_order: nonNegInt.optional(),
  displayOrder: nonNegInt.optional(),
  is_active: z.boolean().optional(),
  isActive: z.boolean().optional(),
  starts_at: ymdOrNull,
  startsAt: ymdOrNull,
  ends_at: ymdOrNull,
  endsAt: ymdOrNull,
}).strict().superRefine(rejectAliasConflicts(BANNER_ALIAS_PAIRS))

const cmsPageBody = z.object({
  slug: z.string().trim().min(1).max(200).optional(),
  title: z.string().trim().min(1).max(300).optional(),
  title_ar: z.string().trim().max(300).nullable().optional(),
  titleAr: z.string().trim().max(300).nullable().optional(),
  content: z.string().trim().max(100_000).optional(),
  content_ar: z.string().trim().max(100_000).nullable().optional(),
  contentAr: z.string().trim().max(100_000).nullable().optional(),
  is_published: z.boolean().optional(),
  isPublished: z.boolean().optional(),
}).strict().superRefine(rejectAliasConflicts(CMS_ALIAS_PAIRS))

const productCreateBody = productBody.superRefine((body, ctx) => {
  if (!body.name) ctx.addIssue({ code: 'custom', message: 'name is required', path: ['name'] })
  if (!body.slug) ctx.addIssue({ code: 'custom', message: 'slug is required', path: ['slug'] })
})

const categoryCreateBody = categoryBody.superRefine((body, ctx) => {
  if (!body.name) ctx.addIssue({ code: 'custom', message: 'name is required', path: ['name'] })
  if (!body.slug) ctx.addIssue({ code: 'custom', message: 'slug is required', path: ['slug'] })
})

const brandCreateBody = brandBody.superRefine((body, ctx) => {
  if (!body.name) ctx.addIssue({ code: 'custom', message: 'name is required', path: ['name'] })
  if (!body.slug) ctx.addIssue({ code: 'custom', message: 'slug is required', path: ['slug'] })
})

const imageCreateBody = imageBody.superRefine((body, ctx) => {
  if (!(body.product_id || body.productId)) {
    ctx.addIssue({ code: 'custom', message: 'product_id is required', path: ['product_id'] })
  }
  if (!(body.image_url || body.imageUrl)) {
    ctx.addIssue({ code: 'custom', message: 'image_url is required', path: ['image_url'] })
  }
})

const certificateCreateBody = certificateBody.superRefine((body, ctx) => {
  if (!(body.product_id || body.productId)) {
    ctx.addIssue({ code: 'custom', message: 'product_id is required', path: ['product_id'] })
  }
  if (!(body.cert_number || body.certNumber)) {
    ctx.addIssue({ code: 'custom', message: 'cert_number is required', path: ['cert_number'] })
  }
  if (!body.authority) {
    ctx.addIssue({ code: 'custom', message: 'authority is required', path: ['authority'] })
  }
})

const bannerCreateBody = bannerBody.superRefine((body, ctx) => {
  if (!body.position) ctx.addIssue({ code: 'custom', message: 'position is required', path: ['position'] })
  if (!body.title) ctx.addIssue({ code: 'custom', message: 'title is required', path: ['title'] })
  if (!(body.image_url || body.imageUrl)) {
    ctx.addIssue({ code: 'custom', message: 'image_url is required', path: ['image_url'] })
  }
  if (!(body.mobile_image_url || body.mobileImageUrl)) {
    ctx.addIssue({ code: 'custom', message: 'mobile_image_url is required', path: ['mobile_image_url'] })
  }
  const start = body.starts_at ?? body.startsAt
  const end = body.ends_at ?? body.endsAt
  if (start && end && start > end) {
    ctx.addIssue({ code: 'custom', message: 'starts_at must not be later than ends_at', path: ['starts_at'] })
  }
})

const cmsCreateBody = cmsPageBody.superRefine((body, ctx) => {
  if (!body.slug) ctx.addIssue({ code: 'custom', message: 'slug is required', path: ['slug'] })
  if (!body.title) ctx.addIssue({ code: 'custom', message: 'title is required', path: ['title'] })
  if (body.content == null || body.content === '') {
    ctx.addIssue({ code: 'custom', message: 'content is required', path: ['content'] })
  }
})

export const catalogResourceSchemas = {
  products: { create: productCreateBody, update: rejectEmptyPatch(productBody) },
  categories: { create: categoryCreateBody, update: rejectEmptyPatch(categoryBody) },
  brands: { create: brandCreateBody, update: rejectEmptyPatch(brandBody) },
  variants: { create: rejectEmptyPatch(variantBody), update: rejectEmptyPatch(variantBody) },
  images: { create: imageCreateBody, update: rejectEmptyPatch(imageBody) },
  stones: { create: stoneWriteBody, update: rejectEmptyPatch(stoneWriteBody) },
  certificates: { create: certificateCreateBody, update: rejectEmptyPatch(certificateBody) },
  banners: { create: bannerCreateBody, update: rejectEmptyPatch(bannerBody) },
  'cms-pages': { create: cmsCreateBody, update: rejectEmptyPatch(cmsPageBody) },
}

export const createVariantCompleteSchema = {
  body: z.object({
    ...variantFields,
    product_id: objectId,
    product_stones: z.array(stoneSchema).max(50).optional(),
    stones: z.array(stoneSchema).max(50).optional(),
    stock_qty: optionalFiniteNumber(z.number().int().min(0).max(1_000_000)),
    stockQty: optionalFiniteNumber(z.number().int().min(0).max(1_000_000)),
    idempotency_key: z.string().trim().min(8).max(128).optional(),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
    stock_idempotency_key: z.string().trim().min(8).max(128).optional(),
    stockIdempotencyKey: z.string().trim().min(8).max(128).optional(),
  }).strict().superRefine((body, ctx) => {
    rejectAliasConflicts(VARIANT_ALIAS_PAIRS)(body, ctx)
    rejectReservedMetadata(body, ctx)
  }),
}

export const updateVariantCompleteSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    ...variantFields,
    product_stones: z.array(stoneSchema).max(50).optional(),
    stones: z.array(stoneSchema).max(50).optional(),
    stock_qty: optionalFiniteNumber(z.number().int().min(0).max(1_000_000)),
    stockQty: optionalFiniteNumber(z.number().int().min(0).max(1_000_000)),
    expected_stock_qty: optionalFiniteNumber(z.number().int().min(0)),
    expectedStockQty: optionalFiniteNumber(z.number().int().min(0)),
    idempotency_key: z.string().trim().min(8).max(128).optional(),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
    stock_idempotency_key: z.string().trim().min(8).max(128).optional(),
    stockIdempotencyKey: z.string().trim().min(8).max(128).optional(),
  }).strict().superRefine((body, ctx) => {
    rejectAliasConflicts(VARIANT_ALIAS_PAIRS)(body, ctx)
    rejectReservedMetadata(body, ctx)
    const stock = body.stock_qty ?? body.stockQty
    const expected = body.expected_stock_qty ?? body.expectedStockQty
    if (stock !== undefined && expected === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'expected_stock_qty is required when stock_qty is provided',
        path: ['expected_stock_qty'],
      })
    }
  }),
}

export const setPrimaryImageSchema = {
  params: z.object({ id: objectId }),
  body: z.object({}).strict().optional().default({}),
}

export const catalogResourceIdSchema = {
  params: z.object({ resource: catalogResourceEnum, id: objectId }),
}

export const catalogListSchema = {
  params: z.object({ resource: catalogResourceEnum }),
}

export const catalogDetailSchema = {
  params: z.object({
    resource: catalogResourceEnum,
    id: z.string().min(1).max(200),
  }),
}

/** Dynamic body schema selected from `:resource`. */
export function catalogWriteSchemaFor(resource, mode = 'create') {
  const entry = catalogResourceSchemas[resource]
  if (!entry) return null
  return mode === 'create' ? entry.create : entry.update
}

/** @deprecated Use validateCatalogWrite middleware. */
export const catalogWriteSchema = {
  params: z.object({
    resource: catalogResourceEnum,
    id: objectId.optional(),
  }),
  body: z.record(z.unknown()),
}

export const catalogProductWriteSchema = {
  body: productBody,
  params: z.object({ resource: z.literal('products').optional(), id: objectId.optional() }),
}

export const catalogCategoryWriteSchema = {
  body: categoryBody,
  params: z.object({ resource: z.literal('categories').optional(), id: objectId.optional() }),
}

export const catalogVariantWriteSchema = {
  body: variantBody,
  params: z.object({ resource: z.literal('variants').optional(), id: objectId.optional() }),
}

export const storeSettingsBody = z.object({
  store_name: z.string().trim().max(200).optional(),
  legal_name: z.string().trim().max(200).optional(),
  support_email: z.string().trim().email().max(200).nullable().optional(),
  support_phone: z.string().trim().max(40).nullable().optional(),
  logo_url: z.string().trim().max(2048).nullable().optional(),
  cod_enabled: z.boolean().optional(),
  bank_transfer_enabled: z.boolean().optional(),
  shipping_fee: z.coerce.number().finite().min(0).optional(),
  free_shipping_threshold: z.coerce.number().finite().min(0).optional(),
  cod_min_order: z.coerce.number().finite().min(0).optional(),
}).strict()

export const taxSettingsBody = z.object({
  tax_name: z.string().trim().max(120).optional(),
  tax_percent: z.coerce.number().finite().min(0).max(100).optional(),
  tax_mode: z.enum(['exclusive', 'inclusive']).optional(),
  tax_registration_number: z.string().trim().max(120).nullable().optional(),
  apply_on: z.enum(['total', 'subtotal']).optional(),
  is_active: z.boolean().optional(),
}).strict()
