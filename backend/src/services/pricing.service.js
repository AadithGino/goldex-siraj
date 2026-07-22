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

async function loadLiveStoneBreakup(variantId, session) {
  const stones = await ProductStone.find({ variantId }).sort({ displayOrder: 1, createdAt: 1 }).session(session || null)
  if (!stones.length) return []

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
      const referenced = await StoneRate.findById(stone.stoneRateId).session(session || null)
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

    const candidates = await StoneRate.find({ isCurrent: true, unit }).sort({ effectiveAt: -1 }).session(session || null)
    const rate = candidates.find((row) => (
      normalizeStoneKey(row.stoneType) === normalizeStoneKey(stoneType)
      && normalizeStoneKey(row.grade || '') === normalizeStoneKey(grade || '')
    )) || null

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
  const variant = await Variant.findOne({ _id: variantId, isActive: true }).session(session)
  if (!variant) throw new AppError(404, 'VARIANT_NOT_FOUND', 'Product variant not found')

  const [product, tax] = await Promise.all([
    Product.findById(variant.productId).session(session),
    TaxSetting.findOne({ singleton: 'default' }).session(session),
  ])
  if (!product || product.status !== 'active') {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found or not available for sale')
  }

  const purity = normalizePurity(variant.purity || product.purity || '22k')
  let goldRate = rateMap?.[purity]
  let goldRateDoc = null
  if (goldRate == null) {
    goldRateDoc = await GoldRate.findOne({ purity, isCurrent: true }).sort({ effectiveAt: -1 }).session(session)
    goldRate = goldRateDoc?.ratePerGram
  }
  const useFixedPrice = !options.ignoreFixedPrice && variant.fixedPrice > 0
  if (!useFixedPrice && !(Number(goldRate) > 0)) {
    throw new AppError(409, 'GOLD_RATE_MISSING', `Current ${purity} gold rate is unavailable`)
  }

  const stoneBreakup = await loadLiveStoneBreakup(variant.id, session)
  const variantForBreakup = { ...variant.toObject?.() || variant, purity }
  const productForBreakup = { ...product.toObject?.() || product, purity: product.purity ? normalizePurity(product.purity, { optional: true }) || product.purity : purity }
  return {
    variant_id: variant.id,
    product_id: product.id,
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
