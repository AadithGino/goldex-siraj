import { Product, ProductStone, StoreSetting, TaxSetting, Variant } from '../models/catalog.models.js'
import { Coupon, CouponRedemption } from '../models/commerce.models.js'
import { GoldRate, StoneRate } from '../models/rate.models.js'
import { AppError } from '../utils/AppError.js'
import { finalizeLineCartTotals } from '../utils/cartTotals.js'
import { nonNegativeMoney, roundMoney } from '../utils/money.js'
import { normalizePurity } from '../utils/purity.js'
import { calculateBreakup } from './pricingCalculator.js'

function normalizeStoneKey(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeStoneRateLookupKey({ stoneType, grade, unit }) {
  return `${normalizeStoneKey(stoneType)}|${normalizeStoneKey(grade || '')}|${unit === 'carat' ? 'carat' : 'piece'}`
}

async function loadLiveStoneBreakup(variantId, session, context = {}) {
  const stones = await ProductStone.find({ variantId }).sort({ displayOrder: 1, createdAt: 1 }).session(session || null).lean()
  if (!stones.length) return []

  const referencedRateIds = [...new Set(
    stones
      .map((stone) => stone?.stoneRateId)
      .filter(Boolean)
      .map((id) => String(id)),
  )]
  const referencedRateCache = context.referencedStoneRatesById || new Map()
  const currentRateCache = context.currentStoneRatesByKey || null
  const missingReferencedRateIds = referencedRateIds.filter((id) => !referencedRateCache.has(id))
  const [referencedRates, currentRates] = await Promise.all([
    missingReferencedRateIds.length
      ? StoneRate.find({ _id: { $in: missingReferencedRateIds } }).session(session || null).lean()
      : Promise.resolve([]),
    currentRateCache
      ? Promise.resolve([])
      : StoneRate.find({ isCurrent: true }).sort({ effectiveAt: -1 }).session(session || null).lean(),
  ])
  referencedRates.forEach((rate) => referencedRateCache.set(String(rate._id), rate))
  const currentByKey = currentRateCache || new Map()
  if (!currentRateCache) {
    for (const rate of currentRates) {
      const key = normalizeStoneRateLookupKey({
        stoneType: rate.stoneType,
        grade: rate.grade,
        unit: rate.unit,
      })
      if (!currentByKey.has(key)) currentByKey.set(key, rate)
    }
    context.currentStoneRatesByKey = currentByKey
  }
  context.referencedStoneRatesById = referencedRateCache

  const breakup = []
  for (const stone of stones) {
    const stoneType = String(stone.stoneType || '').trim()
    const grade = stone.grade == null || stone.grade === '' ? null : String(stone.grade).trim()
    const unit = stone.unit === 'carat' ? 'carat' : 'piece'
    const stoneCount = Number(stone.stoneCount || 0)
    const stoneWeight = Number(stone.weight || 0)
    const mode = stone.pricingMode === 'fixed'
      || (!stone.stoneRateId && stone.manualCharge != null)
      ? 'fixed'
      : 'rate'

    if (!stoneType) throw new AppError(422, 'INVALID_STONE', 'Stone type is required')
    if (!['carat', 'piece'].includes(unit)) throw new AppError(422, 'INVALID_STONE_UNIT', 'Stone unit must be carat or piece')
    if (unit === 'piece') {
      if (!Number.isFinite(stoneCount) || stoneCount < 1) {
        throw new AppError(422, 'INVALID_STONE_COUNT', 'Piece-rated stones require a stone count of at least 1')
      }
    } else if (!Number.isFinite(stoneWeight) || stoneWeight <= 0) {
      throw new AppError(422, 'INVALID_STONE_WEIGHT', 'Carat-rated stones require a stone weight greater than zero')
    }

    if (mode === 'fixed') {
      const amount = Number(stone.manualCharge)
      if (!Number.isFinite(amount) || amount < 0) {
        throw new AppError(422, 'INVALID_MANUAL_CHARGE', 'Fixed stone manual_charge must be a non-negative finite number')
      }
      breakup.push({
        product_stone_id: stone.id,
        stone_type: stoneType,
        grade,
        unit,
        stone_count: stoneCount,
        stone_weight: stoneWeight,
        pricing_mode: 'fixed',
        rate: null,
        rate_id: null,
        rate_effective_at: null,
        amount: roundMoney(amount),
        label: stone.label || null,
        shape: stone.shape || null,
        size_mm: stone.sizeMm ?? null,
        setting_type: stone.settingType || null,
      })
      continue
    }

    if (stone.stoneRateId) {
      const referenced = referencedRateCache.get(String(stone.stoneRateId))
      if (!referenced) {
        throw new AppError(409, 'STONE_RATE_ORPHAN', 'Referenced stone_rate_id no longer exists', {
          stone_rate_id: String(stone.stoneRateId),
        })
      }
      if (
        normalizeStoneKey(referenced.stoneType) !== normalizeStoneKey(stoneType)
        || normalizeStoneKey(referenced.grade || '') !== normalizeStoneKey(grade || '')
        || (referenced.unit === 'carat' ? 'carat' : 'piece') !== unit
      ) {
        throw new AppError(409, 'STONE_RATE_MISMATCH', 'Stored stone configuration does not match referenced StoneRate')
      }
    }

    const rate = currentByKey.get(normalizeStoneRateLookupKey({ stoneType, grade, unit })) || null

    if (!rate || !(Number(rate.rate) > 0)) {
      throw new AppError(
        409,
        'STONE_RATE_MISSING',
        `Current ${stoneType}${grade ? ` / ${grade}` : ''} rate per ${unit} is unavailable`,
        { stone_type: stoneType, grade, unit },
      )
    }
    if (rate.unit !== unit) {
      throw new AppError(409, 'STONE_RATE_UNIT_MISMATCH', `Stone rate unit ${rate.unit} does not match stone unit ${unit}`)
    }

    const amount = unit === 'carat'
      ? roundMoney(stoneWeight * Number(rate.rate))
      : roundMoney(stoneCount * Number(rate.rate))

    breakup.push({
      product_stone_id: stone.id,
      stone_type: stoneType,
      grade,
      unit,
      stone_count: stoneCount,
      stone_weight: stoneWeight,
      pricing_mode: 'rate',
      rate: Number(rate.rate),
      rate_id: rate.id,
      rate_effective_at: rate.effectiveAt || null,
      amount,
      label: stone.label || null,
      shape: stone.shape || null,
      size_mm: stone.sizeMm ?? null,
      setting_type: stone.settingType || null,
    })
  }
  return breakup
}

export async function getPriceBreakup(variantId, qty = 1, rateMap = null, options = {}) {
  const session = options.session || null
  const shared = options.sharedContext || null
  const variant = options.variantDoc
    || await Variant.findOne({ _id: variantId, isActive: true }).session(session).lean()
  if (!variant) throw new AppError(404, 'VARIANT_NOT_FOUND', 'Product variant not found')

  let product = null
  const productKey = String(variant.productId)
  if (shared?.productsById?.has(productKey)) {
    product = shared.productsById.get(productKey)
  } else {
    product = await Product.findById(variant.productId).session(session).lean()
    if (shared?.productsById) shared.productsById.set(productKey, product || null)
  }
  let tax = shared?.taxDoc
  if (!tax) {
    tax = await TaxSetting.findOne({ singleton: 'default' }).session(session).lean()
    if (shared) shared.taxDoc = tax || null
  }
  if (!product || product.status !== 'active') {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found or not available for sale')
  }

  const purity = normalizePurity(variant.purity || product.purity || '22k')
  let goldRate = rateMap?.[purity]
  let goldRateDoc = null
  if (goldRate == null) {
    if (shared?.goldRatesByPurity?.has(purity)) {
      goldRateDoc = shared.goldRatesByPurity.get(purity)
    } else {
      goldRateDoc = await GoldRate.findOne({ purity, isCurrent: true }).sort({ effectiveAt: -1 }).session(session).lean()
      if (shared?.goldRatesByPurity) shared.goldRatesByPurity.set(purity, goldRateDoc || null)
    }
    goldRate = goldRateDoc?.ratePerGram
  }
  const useFixedPrice = !options.ignoreFixedPrice && variant.fixedPrice > 0
  if (!useFixedPrice && !(Number(goldRate) > 0)) {
    throw new AppError(409, 'GOLD_RATE_MISSING', `Current ${purity} gold rate is unavailable`)
  }

  const stoneBreakup = await loadLiveStoneBreakup(String(variant._id), session, shared || {})
  const variantForBreakup = { ...variant, purity }
  const productForBreakup = { ...product, purity: product.purity ? normalizePurity(product.purity, { optional: true }) || product.purity : purity }
  return {
    variant_id: String(variant._id),
    product_id: String(product._id),
    purity,
    ...calculateBreakup({
      variant: variantForBreakup,
      product: productForBreakup,
      tax,
      goldRate: Number(goldRate || 0),
      qty,
      ignoreFixedPrice: options.ignoreFixedPrice,
      stoneBreakup,
      goldRateEffectiveAt: goldRateDoc?.effectiveAt || null,
    }),
  }
}

export async function getPriceBreakups(variantIds = []) {
  const ids = [...new Set(
    (Array.isArray(variantIds) ? variantIds : [])
      .map((id) => String(id || '').trim())
      .filter((id) => /^[a-f\d]{24}$/i.test(id)),
  )]
  if (!ids.length) return []
  const variants = await Variant.find({ _id: { $in: ids }, isActive: true }).lean()
  const variantsById = new Map(variants.map((variant) => [String(variant._id), variant]))
  const sharedContext = {
    productsById: new Map(),
    goldRatesByPurity: new Map(),
    currentStoneRatesByKey: new Map(),
    referencedStoneRatesById: new Map(),
    taxDoc: null,
  }
  const rows = await Promise.all(ids.map(async (variantId) => {
    try {
      const breakup = await getPriceBreakup(variantId, 1, null, {
        variantDoc: variantsById.get(variantId),
        sharedContext,
      })
      return {
        variant_id: variantId,
        total: breakup.total ?? null,
      }
    } catch {
      return {
        variant_id: variantId,
        total: null,
      }
    }
  }))
  return rows
}

/**
 * Fast listing prices: avoids per-variant live stone-rate queries.
 * Uses variant/product stored stone and making charges with latest gold/tax.
 */
export async function getListingPriceTotals(variantIds = []) {
  const ids = [...new Set(
    (Array.isArray(variantIds) ? variantIds : [])
      .map((id) => String(id || '').trim())
      .filter((id) => /^[a-f\d]{24}$/i.test(id)),
  )]
  if (!ids.length) return []

  const variants = await Variant.find({ _id: { $in: ids }, isActive: true }).lean()
  const variantsById = new Map(variants.map((variant) => [String(variant._id), variant]))
  const productIds = [...new Set(variants.map((variant) => String(variant.productId)).filter(Boolean))]
  const [products, tax] = await Promise.all([
    productIds.length ? Product.find({ _id: { $in: productIds }, status: 'active' }).lean() : Promise.resolve([]),
    TaxSetting.findOne({ singleton: 'default' }).lean(),
  ])
  const productsById = new Map(products.map((product) => [String(product._id), product]))

  const purities = [...new Set(variants.map((variant) => {
    const product = productsById.get(String(variant.productId))
    return normalizePurity(variant.purity || product?.purity || '22k')
  }))]
  const goldRates = await GoldRate.find({ isCurrent: true, purity: { $in: purities } }).sort({ effectiveAt: -1 }).lean()
  const goldRateByPurity = new Map()
  for (const rate of goldRates) {
    if (!goldRateByPurity.has(rate.purity)) goldRateByPurity.set(rate.purity, rate)
  }

  return ids.map((variantId) => {
    const variant = variantsById.get(variantId)
    if (!variant) return { variant_id: variantId, total: null }
    const product = productsById.get(String(variant.productId))
    if (!product) return { variant_id: variantId, total: null }
    try {
      const purity = normalizePurity(variant.purity || product.purity || '22k')
      const goldRate = Number(goldRateByPurity.get(purity)?.ratePerGram || 0)
      const breakup = calculateBreakup({
        variant: { ...variant, purity },
        product: { ...product, purity },
        tax,
        goldRate,
        qty: 1,
      })
      return { variant_id: variantId, total: breakup.total ?? null }
    } catch {
      return { variant_id: variantId, total: null }
    }
  })
}

export async function validateCoupon(codeInput, orderTotal, customerId) {
  const code = String(codeInput || '').trim().toUpperCase()
  const coupon = await Coupon.findOne({
    code,
    isActive: true,
    validFrom: { $lte: new Date() },
    $or: [{ validTo: null }, { validTo: { $gte: new Date() } }],
  })
  if (!coupon) return { valid: false, reason: 'invalid_or_expired', discount_amount: 0 }
  const total = nonNegativeMoney(orderTotal)
  if (total < coupon.minOrder) return { valid: false, reason: 'minimum_order_not_met', discount_amount: 0, min_order: coupon.minOrder }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return { valid: false, reason: 'usage_limit_reached', discount_amount: 0 }
  if (customerId && await CouponRedemption.countDocuments({
    couponId: coupon.id,
    customerId,
    status: { $ne: 'rolled_back' },
  }) >= coupon.perCustomerLimit) {
    return { valid: false, reason: 'customer_limit_reached', discount_amount: 0 }
  }
  let discount = coupon.discountType === 'percent' ? total * coupon.discountValue / 100 : coupon.discountValue
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount)
  return {
    valid: true,
    coupon_id: coupon.id,
    code: coupon.code,
    discount_type: coupon.discountType,
    discount_value: coupon.discountValue,
    max_discount: coupon.maxDiscount ?? null,
    discount_amount: Math.min(roundMoney(discount), total),
  }
}

export async function calculateCartTotals(lines, discount = 0) {
  const [store, tax] = await Promise.all([
    StoreSetting.findOne({ singleton: 'default' }),
    TaxSetting.findOne({ singleton: 'default' }),
  ])
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.breakup.unit_subtotal_before_vat * line.qty, 0))
  const afterDiscount = nonNegativeMoney(subtotal - discount)
  const shipping = store?.freeShippingThreshold > 0 && afterDiscount >= store.freeShippingThreshold
    ? 0
    : Number(store?.shippingFee || 0)

  // Line-level VAT + proportional coupon allocation (mutates line.breakup snapshots).
  return finalizeLineCartTotals({ lines, discount, tax, shippingFee: shipping })
}

/**
 * Authoritative cart quote for checkout UI. Does not reserve coupons, stock, or wallet.
 */
export async function quoteCustomerCart(customerId, { coupon_code: couponCode } = {}) {
  const { CartItem } = await import('../models/commerce.models.js')
  const rows = await CartItem.find({ customerId }).sort({ addedAt: -1 })
  if (!rows.length) {
    return {
      lines: [],
      coupon: null,
      totals: {
        subtotal: 0,
        discount_amount: 0,
        tax_amount: 0,
        shipping_fee: 0,
        total: 0,
        standard_rated_total: 0,
        zero_rated_total: 0,
        exempt_total: 0,
        tax_breakdown: {
          standard_rated_total: 0,
          zero_rated_total: 0,
          exempt_total: 0,
          vat_total: 0,
        },
      },
    }
  }

  const lines = []
  for (const row of rows) {
    const breakup = await getPriceBreakup(row.variantId, 1)
    lines.push({
      qty: row.qty,
      breakup,
      cart_item_id: row.id,
      variant_id: String(row.variantId),
      customization_request: row.customizationRequest ?? null,
    })
  }

  const rawSubtotal = roundMoney(lines.reduce(
    (sum, line) => sum + Number(line.breakup.unit_subtotal_before_vat || 0) * Number(line.qty || 1),
    0,
  ))

  let discount = 0
  let couponPayload = null
  if (couponCode) {
    const couponResult = await validateCoupon(couponCode, rawSubtotal, customerId)
    if (!couponResult.valid) {
      throw new AppError(422, 'INVALID_COUPON', couponResult.reason || 'Coupon is not valid', couponResult)
    }
    discount = couponResult.discount_amount
    couponPayload = {
      code: couponResult.code,
      discount_type: couponResult.discount_type,
      discount_value: couponResult.discount_value,
      discount_amount: couponResult.discount_amount,
      max_discount: couponResult.max_discount,
    }
  }

  const totals = await calculateCartTotals(lines, discount)
  return {
    lines: lines.map((line) => ({
      cart_item_id: line.cart_item_id,
      variant_id: line.variant_id,
      qty: line.qty,
      customization_request: line.customization_request ?? null,
      breakup: line.breakup,
    })),
    coupon: couponPayload,
    totals: {
      subtotal: totals.subtotal,
      discount_amount: totals.discountAmount,
      tax_amount: totals.taxAmount,
      shipping_fee: totals.shippingFee,
      total: totals.total,
      vat_percent: totals.vat_percent,
      vat_apply_on: totals.vat_apply_on,
      tax_mode: totals.tax_mode,
      standard_rated_total: totals.standard_rated_total,
      zero_rated_total: totals.zero_rated_total,
      exempt_total: totals.exempt_total,
      tax_breakdown: totals.tax_breakdown,
    },
  }
}
