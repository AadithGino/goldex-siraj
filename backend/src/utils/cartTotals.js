import { computeVat } from '../services/pricingCalculator.js'
import { nonNegativeMoney, roundMoney } from './money.js'
import { resolveTaxTreatment } from './purity.js'

/**
 * Allocate a cart-level discount across lines proportionally by eligible base.
 * Remainder (after rounding) goes to the last eligible line. Never exceeds a line's base.
 *
 * @param {Array<{ base: number }>} lines
 * @param {number} discount
 * @returns {number[]} per-line discount amounts (same length)
 */
export function allocateProportionalDiscount(lines, discount) {
  const bases = lines.map((line) => nonNegativeMoney(line.base))
  const subtotal = roundMoney(bases.reduce((sum, base) => sum + base, 0))
  const target = Math.min(nonNegativeMoney(discount), subtotal)
  if (target <= 0 || subtotal <= 0) return bases.map(() => 0)

  const allocations = bases.map(() => 0)
  let allocated = 0
  const eligibleIndexes = bases
    .map((base, index) => (base > 0 ? index : -1))
    .filter((index) => index >= 0)

  for (let i = 0; i < eligibleIndexes.length; i += 1) {
    const index = eligibleIndexes[i]
    const isLast = i === eligibleIndexes.length - 1
    if (isLast) {
      allocations[index] = nonNegativeMoney(Math.min(bases[index], target - allocated))
    } else {
      const share = roundMoney((bases[index] / subtotal) * target)
      allocations[index] = nonNegativeMoney(Math.min(bases[index], share))
      allocated = roundMoney(allocated + allocations[index])
    }
  }

  const sum = roundMoney(allocations.reduce((s, n) => s + n, 0))
  const drift = roundMoney(target - sum)
  if (drift !== 0 && eligibleIndexes.length) {
    const last = eligibleIndexes[eligibleIndexes.length - 1]
    allocations[last] = nonNegativeMoney(Math.min(bases[last], roundMoney(allocations[last] + drift)))
  }

  return allocations
}

/**
 * Apply line-level VAT after coupon allocation. Mutates each `line.breakup` in place.
 * Cart VAT is Σ line VAT — never recomputed from a mixed cart treatment.
 */
export function finalizeLineCartTotals({ lines, discount = 0, tax = null, shippingFee = 0 }) {
  const subtotal = roundMoney(lines.reduce(
    (sum, line) => sum + Number(line.breakup.unit_subtotal_before_vat || 0) * Number(line.qty || 1),
    0,
  ))
  const makingChargeTotal = roundMoney(lines.reduce(
    (sum, line) => sum + Number(line.breakup.making_charge || 0) * Number(line.qty || 1),
    0,
  ))

  const bases = lines.map((line) => ({
    base: roundMoney(Number(line.breakup.unit_subtotal_before_vat || 0) * Number(line.qty || 1)),
  }))
  const allocations = allocateProportionalDiscount(bases, discount)
  const discountAmount = roundMoney(allocations.reduce((sum, amount) => sum + amount, 0))

  let taxAmount = 0
  let standardRatedTotal = 0
  let zeroRatedTotal = 0
  let exemptTotal = 0
  let vatPercent = 0
  const taxMode = tax?.taxMode || 'exclusive'
  const applyOn = tax?.applyOn || 'total'

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const qty = Math.max(Number(line.qty) || 1, 1)
    const lineSubtotal = bases[i].base
    const lineDiscount = allocations[i]
    const discountedBase = nonNegativeMoney(lineSubtotal - lineDiscount)

    const treatment = resolveTaxTreatment(
      line.breakup.purity,
      line.breakup.tax_treatment || line.product?.taxTreatment || line.variant?.taxTreatment,
    )

    let vatBase = discountedBase
    if (applyOn === 'making_only') {
      // Zero-rated / exempt lines never contribute making-charge VAT.
      if (treatment === 'zero_rated' || treatment === 'exempt') {
        vatBase = 0
      } else {
        const makingLine = roundMoney(Number(line.breakup.making_charge || 0) * qty)
        vatBase = lineSubtotal > 0
          ? nonNegativeMoney(makingLine - (lineDiscount * makingLine) / lineSubtotal)
          : makingLine
      }
    }

    const vat = computeVat({ taxableBase: vatBase, tax, taxTreatment: treatment })
    vatPercent = Math.max(vatPercent, vat.vat_percent)

    const lineTotal = roundMoney(
      vat.tax_mode === 'inclusive' ? discountedBase : discountedBase + vat.vat_amount,
    )
    const unitPrice = roundMoney(lineTotal / qty)

    line.breakup = {
      ...line.breakup,
      tax_treatment: treatment,
      is_zero_rated: treatment === 'zero_rated',
      is_exempt: treatment === 'exempt',
      discount_amount: lineDiscount,
      discounted_base: discountedBase,
      taxable_base: vatBase,
      tax_rate: vat.vat_percent,
      vat_percent: vat.vat_percent,
      vat_apply_on: vat.vat_apply_on,
      tax_mode: vat.tax_mode,
      vat_amount: vat.vat_amount,
      unit_vat_amount: roundMoney(vat.vat_amount / qty),
      unit_price: unitPrice,
      unit_total: unitPrice,
      line_total: lineTotal,
      total: lineTotal,
      display_total: unitPrice,
      subtotal: lineSubtotal,
      subtotal_before_vat: lineSubtotal,
    }

    taxAmount = roundMoney(taxAmount + vat.vat_amount)
    if (treatment === 'zero_rated') zeroRatedTotal = roundMoney(zeroRatedTotal + discountedBase)
    else if (treatment === 'exempt') exemptTotal = roundMoney(exemptTotal + discountedBase)
    else standardRatedTotal = roundMoney(standardRatedTotal + discountedBase)
  }

  const shipping = Number(shippingFee || 0)
  // Invariant: cart total equals sum of rounded line snapshots + shipping
  const linesSum = roundMoney(lines.reduce((sum, line) => sum + Number(line.breakup.line_total || 0), 0))
  const expectedWithoutShip = taxMode === 'inclusive'
    ? nonNegativeMoney(subtotal - discountAmount)
    : nonNegativeMoney(subtotal - discountAmount) + taxAmount
  // Drift correction on last line if needed (floating edge cases)
  const drift = roundMoney(expectedWithoutShip - linesSum)
  if (drift !== 0 && lines.length) {
    const last = lines[lines.length - 1]
    last.breakup.line_total = roundMoney(Number(last.breakup.line_total) + drift)
    last.breakup.total = last.breakup.line_total
    const qty = Math.max(Number(last.qty) || 1, 1)
    last.breakup.unit_price = roundMoney(last.breakup.line_total / qty)
    last.breakup.unit_total = last.breakup.unit_price
    last.breakup.display_total = last.breakup.unit_price
  }

  return {
    subtotal,
    makingChargeTotal,
    discountAmount,
    taxAmount,
    shippingFee: shipping,
    total: roundMoney(
      taxMode === 'inclusive'
        ? nonNegativeMoney(subtotal - discountAmount) + shipping
        : nonNegativeMoney(subtotal - discountAmount) + shipping + taxAmount,
    ),
    vat_percent: vatPercent,
    vat_apply_on: applyOn,
    tax_mode: taxMode,
    standard_rated_total: standardRatedTotal,
    zero_rated_total: zeroRatedTotal,
    exempt_total: exemptTotal,
    tax_breakdown: {
      standard_rated_total: standardRatedTotal,
      zero_rated_total: zeroRatedTotal,
      exempt_total: exemptTotal,
      vat_total: taxAmount,
    },
  }
}
