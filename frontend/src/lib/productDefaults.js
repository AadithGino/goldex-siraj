import { normalizeGender } from '@/lib/constants'
import {
  parseLowStockThreshold,
  parseOptionalNumber,
  parseRequiredNumber,
  PayloadValidationError,
} from './numberParse.js'

export const DEFAULT_PRODUCT = {
  name: '',
  name_ar: '',
  slug: '',
  category_id: '',
  brand_id: '',
  short_desc: '',
  short_desc_ar: '',
  description: '',
  description_ar: '',
  metal_type: 'gold',
  metal_color: 'yellow',
  purity: '22k',
  gender: 'unisex',
  occasion: [],
  making_charge_type: 'percent',
  making_charge_value: 0,
  wastage_percent: 0,
  tax_treatment: 'standard',
  is_featured: false,
  is_customizable: false,
  customization_note: '',
  video_url: '',
  status: 'draft',
}

export const PRODUCT_DB_FIELDS = [
  'category_id',
  'name',
  'name_ar',
  'slug',
  'brand_id',
  'description',
  'description_ar',
  'short_description',
  'short_description_ar',
  'metal_type',
  'metal_color',
  'purity',
  'gender',
  'occasion',
  'making_charge_type',
  'making_charge_value',
  'wastage_percent',
  'tax_treatment',
  'status',
  'is_featured',
  'display_order',
  'is_customizable',
  'customization_note',
]

export function normalizeOccasions(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

export function pickProductDbPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => PRODUCT_DB_FIELDS.includes(key))
  )
}

export function toProductPayload(input = {}) {
  const wastagePercentRaw =
    input.wastage_percent == null || input.wastage_percent === ''
      ? 0
      : Number(input.wastage_percent)
  const wastagePercent = Number.isFinite(wastagePercentRaw)
    ? Math.max(0, wastagePercentRaw)
    : 0

  const payload = {
    category_id: input.category_id || null,
    name: input.name ?? null,
    name_ar: input.name_ar ?? null,
    slug: input.slug ?? null,
    brand_id: input.brand_id || null,
    description: input.description ?? null,
    description_ar: input.description_ar ?? null,
    short_description: input.short_description ?? input.short_desc ?? null,
    short_description_ar: input.short_description_ar ?? input.short_desc_ar ?? null,
    metal_type: input.metal_type ?? 'gold',
    metal_color: input.metal_color ?? 'yellow',
    purity: input.purity ?? null,
    gender: input.gender ?? 'unisex',
    occasion: normalizeOccasions(input.occasion),
    making_charge_type: input.making_charge_type ?? 'percent',
    making_charge_value: Number(input.making_charge_value) || 0,
    wastage_percent: wastagePercent,
    tax_treatment:
      input.tax_treatment === 'investment_precious_metal_zero_rated'
        ? 'investment_precious_metal_zero_rated'
        : 'standard',
    status: input.status ?? 'draft',
    is_featured: input.is_featured === true,
    display_order: Number(input.display_order) || 0,
    is_customizable: input.is_customizable === true,
    customization_note: input.customization_note ?? null,
  }
  return pickProductDbPayload(payload)
}

export function productToFormState(product) {
  if (!product) return { ...DEFAULT_PRODUCT }
  const state = {
    ...DEFAULT_PRODUCT,
    ...toProductPayload(product),
    short_desc: product.short_description ?? '',
    short_desc_ar: product.short_description_ar ?? '',
    brand_id: product.brand_id || '',
    metal_color: product.metal_color ?? 'yellow',
    wastage_percent:
      product.wastage_percent == null || product.wastage_percent === ''
        ? 0
        : Number(product.wastage_percent),
    is_customizable: product.is_customizable ?? false,
    customization_note: product.customization_note ?? '',
  }
  state.gender = normalizeGender(state.gender)
  state.occasion = normalizeOccasions(product.occasion)
  state.tax_treatment =
    product.tax_treatment === 'investment_precious_metal_zero_rated'
      ? 'investment_precious_metal_zero_rated'
      : 'standard'
  return state
}

export const DEFAULT_VARIANT = {
  sku: '',
  label: '',
  variant_label: '',
  purity: '22k',
  weight_grams: '',
  effective_weight: '',
  making_charge: 0,
  height_mm: '',
  width_mm: '',
  length_mm: '',
  diameter_mm: '',
  size_unit: 'mm',
  size_type: 'ring',
  size: '',
  size_label: '',
  jewellery_type: '',
  ring_size: '',
  bangle_size: '',
  chain_length_inch: '',
  stone_rate_id: '',
  stone_type: 'none',
  stone_purity: '',
  stone_weight_carat: '',
  stone_charge: 0,
  fixed_price: '',
  compare_at_price: '',
  price_override: '',
  stock_qty: 0,
  low_stock_threshold: 2,
  is_active: true,
  tax_treatment: '',
  metadata: {},
  product_stones: [],
}

export const VARIANT_DB_FIELDS = [
  'product_id',
  'sku',
  'label',
  'label_ar',
  'size_label',
  'purity',
  'weight_grams',
  'effective_weight',
  'making_charge',
  'stone_charge',
  'fixed_price',
  'compare_at_price',
  'stock_qty',
  'low_stock_threshold',
  'is_active',
  'metadata',
  'jewellery_type',
  'ring_size',
  'bangle_size',
  'chain_length_inch',
  'height_mm',
  'width_mm',
  'length_mm',
  'diameter_mm',
  'size_unit',
  'tax_treatment',
]

export function pickVariantDbPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => VARIANT_DB_FIELDS.includes(key))
  )
}

export function toVariantPayload(input = {}) {
  const rawFixedPrice = input.price_override ?? input.priceOverride ?? input.fixed_price
  const jewelleryType = input.jewellery_type || input.size_type || null
  const normalizedSizeLabel =
    input.size_label ||
    input.size ||
    input.ring_size ||
    input.bangle_size ||
    input.chain_length_inch ||
    null
  const ringSize =
    input.ring_size || (jewelleryType === 'ring' ? (input.size || input.size_label || null) : null)
  const bangleSize =
    input.bangle_size || (jewelleryType === 'bangle' ? (input.size || input.size_label || null) : null)
  // Do not embed stone_groups in metadata for normal editing (Phase 22.8).
  const incomingMetadata =
    input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
      ? { ...input.metadata }
      : {}
  delete incomingMetadata.stone_groups

  const payload = {
    sku: input.sku || null,
    label: input.label ?? input.variant_label ?? null,
    label_ar: input.label_ar ?? null,
    size_label: normalizedSizeLabel,
    purity: input.purity || null,
    weight_grams: parseRequiredNumber(input.weight_grams, 'weight_grams', { min: 0.0001 }),
    effective_weight: parseOptionalNumber(input.effective_weight, 'effective_weight', { min: 0 }),
    making_charge: parseOptionalNumber(input.making_charge, 'making_charge', { min: 0 }) ?? 0,
    stone_charge: parseOptionalNumber(input.stone_charge, 'stone_charge', { min: 0 }) ?? 0,
    fixed_price: parseOptionalNumber(rawFixedPrice, 'fixed_price', { min: 0 }),
    compare_at_price: parseOptionalNumber(input.compare_at_price, 'compare_at_price', { min: 0 }),
    stock_qty: parseOptionalNumber(input.stock_qty, 'stock_qty', { integer: true, min: 0 }) ?? 0,
    low_stock_threshold: parseLowStockThreshold(input.low_stock_threshold, 2),
    is_active: input.is_active !== false,
    jewellery_type: jewelleryType,
    ring_size: ringSize,
    bangle_size: bangleSize,
    chain_length_inch: parseOptionalNumber(input.chain_length_inch, 'chain_length_inch', { min: 0 }),
    height_mm: parseOptionalNumber(input.height_mm, 'height_mm', { min: 0 }),
    width_mm: parseOptionalNumber(input.width_mm, 'width_mm', { min: 0 }),
    length_mm: parseOptionalNumber(input.length_mm, 'length_mm', { min: 0 }),
    diameter_mm: parseOptionalNumber(input.diameter_mm, 'diameter_mm', { min: 0 }),
    size_unit: input.size_unit || null,
    tax_treatment:
      input.tax_treatment === 'investment_precious_metal_zero_rated'
        ? 'investment_precious_metal_zero_rated'
        : input.tax_treatment === 'standard'
          ? 'standard'
          : null,
    metadata: incomingMetadata,
  }
  return pickVariantDbPayload(payload)
}

export function toProductStonePayload(stone, displayOrder = 0) {
  const mode = stone.pricing_mode === 'fixed' || (!stone.stone_rate_id && stone.manual_charge != null)
    ? 'fixed'
    : 'rate'

  if (mode === 'rate') {
    if (!stone.stone_rate_id) throw new PayloadValidationError('stone_rate_id is required for rate mode')
    if (!stone.stone_type) throw new PayloadValidationError('stone_type is required for rate mode')
    const unit = stone.unit === 'carat' ? 'carat' : 'piece'
    const weight = unit === 'carat'
      ? parseRequiredNumber(stone.weight ?? stone.stone_weight_carat, 'weight', { min: 0.0001 })
      : parseOptionalNumber(stone.weight ?? stone.stone_weight_carat, 'weight', { min: 0 })
    const count = parseRequiredNumber(stone.stone_count ?? 1, 'stone_count', { integer: true, min: 1 })
    return {
      stone_rate_id: stone.stone_rate_id,
      label: stone.label?.trim() || null,
      stone_type: stone.stone_type,
      grade: stone.grade ?? stone.stone_purity ?? null,
      unit,
      pricing_mode: 'rate',
      stone_count: count,
      weight,
      shape: stone.shape || null,
      size_mm: parseOptionalNumber(stone.size_mm, 'size_mm', { min: 0 }),
      setting_type: stone.setting_type || null,
      display_order: displayOrder,
    }
  }

  const manual = parseRequiredNumber(stone.manual_charge ?? stone.charge, 'manual_charge', { min: 0 })
  return {
    stone_rate_id: null,
    label: stone.label?.trim() || null,
    stone_type: stone.stone_type || stone.label?.trim() || null,
    grade: stone.grade ?? stone.stone_purity ?? null,
    unit: stone.unit === 'carat' ? 'carat' : 'piece',
    pricing_mode: 'fixed',
    stone_count: parseRequiredNumber(stone.stone_count ?? 1, 'stone_count', { integer: true, min: 1 }),
    weight: parseOptionalNumber(stone.weight ?? stone.stone_weight_carat, 'weight', { min: 0 }),
    shape: stone.shape || null,
    size_mm: parseOptionalNumber(stone.size_mm, 'size_mm', { min: 0 }),
    setting_type: stone.setting_type || null,
    manual_charge: manual,
    display_order: displayOrder,
  }
}

export const WIZARD_STEPS = [
  { id: 1, label: 'Product info', description: 'Name, category, pricing rules' },
  { id: 2, label: 'Variants', description: 'Sizes, weight, stones, stock' },
  { id: 3, label: 'Images', description: 'Upload product photos' },
  { id: 4, label: 'Certificates', description: 'Optional hallmark / grading docs' },
]
