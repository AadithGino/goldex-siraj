import { roundMoney } from '../utils/money.js'
import { AppError } from '../utils/AppError.js'
import { normalizePurity, resolveTaxTreatment } from '../utils/purity.js'

/** Tax treatments that do not charge VAT. */
const ZERO_VAT_TREATMENTS = new Set([
  'investment_precious_metal_zero_rated',
  'zero_rated',
  'exempt',
])

/**
 * Authoritative VAT helper shared by item preview and cart/order totals.
 * @param {object} args
 * @param {number} args.taxableBase amount subject to VAT (already include/exclude shipping upstream)
 * @param {object|null} args.tax TaxSetting-like
 * @param {string} [args.taxTreatment] product/variant treatment
 */
export function computeVat({ taxableBase, tax, taxTreatment = 'standard' }) {
  const base = Number(taxableBase)
  if (!Number.isFinite(base) || base < 0) {
    throw new AppError(422, 'INVALID_TAXABLE_BASE', 'Taxable base must be a finite non-negative number')
  }
  const treatment = resolveTaxTreatment(null, taxTreatment)
  const vatPercent = tax?.isActive && !ZERO_VAT_TREATMENTS.has(treatment) && treatment === 'standard'
    ? Number(tax.taxPercent || 0)
    : 0
  const taxMode = tax?.taxMode || 'exclusive'
  const applyOn = tax?.applyOn || 'total'
  const vatAmount = vatPercent <= 0
    ? 0
    : roundMoney(taxMode === 'inclusive'
      ? base * vatPercent / (100 + vatPercent)
      : base * vatPercent / 100)
  return {
    vat_percent: vatPercent,
    tax_mode: taxMode,
    vat_apply_on: applyOn,
    vat_amount: vatAmount,
    tax_treatment: treatment,
  }
}

export function assertMetalWeights({ weightGrams, effectiveWeight }) {
  const gross = Number(weightGrams)
  const effective = effectiveWeight == null || effectiveWeight === ''
    ? gross
    : Number(effectiveWeight)

  if (!Number.isFinite(gross) || gross <= 0) {
    throw new AppError(422, 'INVALID_GROSS_WEIGHT', 'Gross metal weight must be a finite number greater than zero')
  }
  if (!Number.isFinite(effective) || effective <= 0) {
    throw new AppError(422, 'INVALID_EFFECTIVE_WEIGHT', 'Effective metal weight must be a finite number greater than zero')
  }
  if (effective > gross) {
    throw new AppError(422, 'EFFECTIVE_WEIGHT_EXCEEDS_GROSS', 'Effective metal weight cannot exceed gross weight')
  }
  return { gross_weight: gross, effective_weight: effective, net_weight: effective }
}

/**
 * @param {object} params
 * @param {object} params.variant
 * @param {object} params.product
 * @param {object|null} params.tax
 * @param {number} params.goldRate
 * @param {number} [params.qty]
 * @param {boolean} [params.ignoreFixedPrice]
 * @param {Array<object>} [params.stoneBreakup] live stone lines; when provided, replaces variant.stoneCharge
 * @param {Date|string|null} [params.goldRateEffectiveAt]
 */
export function calculateBreakup({
  variant,
  product,
  tax,
  goldRate,
  qty = 1,
  ignoreFixedPrice = false,
  stoneBreakup = null,
  goldRateEffectiveAt = null,
}) {
  const quantity = Math.max(Number(qty) || 1, 1)
  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new AppError(422, 'INVALID_QUANTITY', 'Quantity must be a positive finite number')
  }

  const useFixedPrice = !ignoreFixedPrice && Number(variant.fixedPrice) > 0
  const weights = assertMetalWeights({
    weightGrams: variant.weightGrams,
    effectiveWeight: variant.effectiveWeight,
  })

  const rate = Number(goldRate || 0)
  if (!useFixedPrice && (!(rate > 0) || !Number.isFinite(rate))) {
    throw new AppError(409, 'GOLD_RATE_MISSING', 'A valid gold rate is required for live pricing')
  }

  const goldValue = roundMoney(weights.net_weight * rate)
  const wastagePercent = Math.max(Number(product.wastagePercent || 0), 0)
  const wastageAmount = roundMoney(goldValue * wastagePercent / 100)

  const makingChargeType = product.makingChargeType || 'percent'
  const makingChargeValue = Number(product.makingChargeValue || 0)
  const makingCharge = Number(variant.makingCharge) > 0
    ? Number(variant.makingCharge)
    : makingChargeType === 'percent'
      ? roundMoney(goldValue * makingChargeValue / 100)
      : makingChargeValue

  let stones = Array.isArray(stoneBreakup) ? stoneBreakup : null
  let stoneCharge
  if (stones) {
    stoneCharge = roundMoney(stones.reduce((sum, row) => sum + Number(row.amount || 0), 0))
  } else {
    stoneCharge = Number(variant.stoneCharge || 0)
    stones = []
  }
  if (!Number.isFinite(stoneCharge) || stoneCharge < 0) {
    throw new AppError(422, 'INVALID_STONE_CHARGE', 'Stone charge must be a finite non-negative number')
  }

  const rawPurity = variant.purity || product.purity || null
  const purity = rawPurity == null || rawPurity === ''
    ? null
    : normalizePurity(rawPurity)
  const taxTreatment = resolveTaxTreatment(
    purity,
    variant.taxTreatment || product.taxTreatment || 'standard',
  )

  const unitSubtotalBeforeVat = roundMoney(
    useFixedPrice
      ? Number(variant.fixedPrice)
      : goldValue + wastageAmount + makingCharge + stoneCharge,
  )

  const applyOn = tax?.applyOn || 'total'
  const vatBase = applyOn === 'making_only' ? makingCharge : unitSubtotalBeforeVat
  const vat = computeVat({ taxableBase: vatBase * quantity, tax, taxTreatment })
  const unitVat = computeVat({ taxableBase: vatBase, tax, taxTreatment })

  const unitTotal = roundMoney(
    unitVat.tax_mode === 'inclusive' ? unitSubtotalBeforeVat : unitSubtotalBeforeVat + unitVat.vat_amount,
  )
  const lineTotal = roundMoney(unitTotal * quantity)

  return {
    qty: quantity,
    purity,
    gross_weight: weights.gross_weight,
    weight_grams: weights.gross_weight,
    effective_weight: weights.effective_weight,
    net_weight: weights.net_weight,
    gold_rate: rate,
    gold_rate_per_gram: rate,
    gold_rate_effective_at: goldRateEffectiveAt || null,
    gold_value: goldValue,
    wastage_percent: wastagePercent,
    wastage_amount: wastageAmount,
    making_charge_type: makingChargeType,
    making_charge_value: makingChargeValue,
    making_charge: makingCharge,
    stone_breakup: stones,
    stone_charge: stoneCharge,
    unit_subtotal_before_vat: unitSubtotalBeforeVat,
    subtotal_before_vat: roundMoney(unitSubtotalBeforeVat * quantity),
    vat_percent: unitVat.vat_percent,
    tax_rate: unitVat.vat_percent,
    vat_apply_on: unitVat.vat_apply_on,
    tax_mode: unitVat.tax_mode,
    tax_treatment: taxTreatment,
    is_zero_rated: taxTreatment === 'zero_rated',
    is_exempt: taxTreatment === 'exempt',
    vat_amount: vat.vat_amount,
    unit_vat_amount: unitVat.vat_amount,
    taxable_base: roundMoney(vatBase * quantity),
    discounted_base: roundMoney(unitSubtotalBeforeVat * quantity),
    unit_price: unitTotal,
    unit_total: unitTotal,
    line_total: lineTotal,
    subtotal: roundMoney(unitSubtotalBeforeVat * quantity),
    total: lineTotal,
    display_total: lineTotal,
    fixed_price: variant.fixedPrice,
    price_override: variant.fixedPrice,
    discount_amount: 0,
    is_estimate: true,
    price_source: useFixedPrice ? 'fixed' : 'live',
  }
}
