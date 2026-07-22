import { describe, expect, it } from 'vitest'
import { allocateProportionalDiscount, finalizeLineCartTotals } from '../src/utils/cartTotals.js'
import { addCalendarMonths } from '../src/utils/calendarMonths.js'
import { roundMoney } from '../src/utils/money.js'
import { normalizePurity, resolveTaxTreatment } from '../src/utils/purity.js'
import { calculateBreakup, computeVat } from '../src/services/pricingCalculator.js'
import { AppError } from '../src/utils/AppError.js'

const tax5 = { isActive: true, taxPercent: 5, taxMode: 'exclusive', applyOn: 'total' }

function line({ purity, taxTreatment = 'standard', unitSubtotal, making = 0, qty = 1 }) {
  const breakup = calculateBreakup({
    variant: {
      weightGrams: 10,
      effectiveWeight: 10,
      makingCharge: making,
      stoneCharge: 0,
      fixedPrice: unitSubtotal,
      purity,
      taxTreatment,
    },
    product: {
      wastagePercent: 0,
      makingChargeType: 'flat',
      makingChargeValue: 0,
      purity,
      taxTreatment,
    },
    tax: tax5,
    goldRate: 100,
    qty: 1,
  })
  // Force unit subtotal for deterministic cart tests (fixed price path)
  breakup.unit_subtotal_before_vat = unitSubtotal
  breakup.subtotal_before_vat = unitSubtotal
  breakup.making_charge = making
  breakup.purity = normalizePurity(purity)
  breakup.tax_treatment = resolveTaxTreatment(purity, taxTreatment)
  return { qty, breakup }
}

describe('purity normalization', () => {
  it('normalizes casing and aliases to canonical keys', () => {
    expect(normalizePurity('24K')).toBe('24k')
    expect(normalizePurity('24KT')).toBe('24k')
    expect(normalizePurity('24 Karat')).toBe('24k')
    expect(normalizePurity(24)).toBe('24k')
    expect(normalizePurity('22kt')).toBe('22k')
    expect(normalizePurity('21K')).toBe('21k')
    expect(normalizePurity('18 karat')).toBe('18k')
  })

  it('rejects unknown purity values', () => {
    expect(() => normalizePurity('999k')).toThrow(AppError)
    expect(() => normalizePurity('platinum')).toThrow(AppError)
  })

  it('forces 24k to zero_rated regardless of casing', () => {
    expect(resolveTaxTreatment('24KT', 'standard')).toBe('zero_rated')
    expect(resolveTaxTreatment('22k', 'investment_precious_metal_zero_rated')).toBe('zero_rated')
    expect(resolveTaxTreatment('22k', 'exempt')).toBe('exempt')
    expect(resolveTaxTreatment('18k', 'standard')).toBe('standard')
  })
})

describe('line-level VAT and mixed carts', () => {
  it('24KT-only cart → VAT AED 0.00', () => {
    const lines = [line({ purity: '24K', unitSubtotal: 1000 })]
    const totals = finalizeLineCartTotals({ lines, discount: 0, tax: tax5, shippingFee: 0 })
    expect(totals.taxAmount).toBe(0)
    expect(totals.zero_rated_total).toBe(1000)
    expect(totals.total).toBe(1000)
    expect(lines[0].breakup.tax_treatment).toBe('zero_rated')
    expect(lines[0].breakup.is_zero_rated).toBe(true)
  })

  it('22KT / 21KT / 18KT-only carts apply standard VAT', () => {
    for (const purity of ['22k', '21K', '18kt']) {
      const lines = [line({ purity, unitSubtotal: 1000 })]
      const totals = finalizeLineCartTotals({ lines, discount: 0, tax: tax5, shippingFee: 0 })
      expect(totals.taxAmount).toBe(50)
      expect(totals.standard_rated_total).toBe(1000)
      expect(totals.total).toBe(1050)
    }
  })

  it('mixed 24KT + 22KT taxes only the 22KT line', () => {
    const lines = [
      line({ purity: '24k', unitSubtotal: 1000 }),
      line({ purity: '22k', unitSubtotal: 1000 }),
    ]
    const totals = finalizeLineCartTotals({ lines, discount: 0, tax: tax5, shippingFee: 0 })
    expect(totals.taxAmount).toBe(50)
    expect(totals.zero_rated_total).toBe(1000)
    expect(totals.standard_rated_total).toBe(1000)
    expect(totals.total).toBe(2050)
    expect(lines[0].breakup.vat_amount).toBe(0)
    expect(lines[1].breakup.vat_amount).toBe(50)
  })

  it('mixed 24KT + 18KT taxes only the 18KT line', () => {
    const lines = [
      line({ purity: '24k', unitSubtotal: 800 }),
      line({ purity: '18k', unitSubtotal: 200 }),
    ]
    const totals = finalizeLineCartTotals({ lines, discount: 0, tax: tax5, shippingFee: 0 })
    expect(totals.taxAmount).toBe(10)
    expect(totals.total).toBe(1010)
  })

  it('mixed standard and exempt lines', () => {
    const lines = [
      line({ purity: '22k', taxTreatment: 'standard', unitSubtotal: 1000 }),
      line({ purity: '22k', taxTreatment: 'exempt', unitSubtotal: 500 }),
    ]
    const totals = finalizeLineCartTotals({ lines, discount: 0, tax: tax5, shippingFee: 0 })
    expect(totals.taxAmount).toBe(50)
    expect(totals.exempt_total).toBe(500)
    expect(totals.total).toBe(1550)
  })

  it('percentage coupon allocates proportionally and keeps 24KT zero-rated', () => {
    const lines = [
      line({ purity: '24k', unitSubtotal: 1000 }),
      line({ purity: '22k', unitSubtotal: 1000 }),
    ]
    const discount = 200 // 10% of 2000
    const totals = finalizeLineCartTotals({ lines, discount, tax: tax5, shippingFee: 0 })
    expect(totals.discountAmount).toBe(200)
    expect(lines[0].breakup.discount_amount + lines[1].breakup.discount_amount).toBe(200)
    expect(lines[0].breakup.tax_treatment).toBe('zero_rated')
    expect(lines[0].breakup.vat_amount).toBe(0)
    // 22k discounted base 900 → VAT 45
    expect(lines[1].breakup.vat_amount).toBe(45)
    expect(totals.taxAmount).toBe(45)
    expect(totals.total).toBe(1845)
    const lineSum = lines.reduce((s, l) => s + l.breakup.line_total, 0)
    expect(lineSum).toBe(totals.total)
  })

  it('flat coupon remainder lands on the last eligible line', () => {
    const allocations = allocateProportionalDiscount(
      [{ base: 100 }, { base: 100 }, { base: 100 }],
      10,
    )
    expect(allocations.reduce((s, n) => s + n, 0)).toBe(10)
    expect(allocations.every((n) => n <= 100)).toBe(true)
  })

  it('coupon on 24KT-only cart keeps VAT at zero', () => {
    const lines = [line({ purity: '24k', unitSubtotal: 1000 })]
    const totals = finalizeLineCartTotals({ lines, discount: 100, tax: tax5, shippingFee: 0 })
    expect(totals.taxAmount).toBe(0)
    expect(totals.total).toBe(900)
  })

  it('cart total equals sum of rounded line totals + shipping', () => {
    const lines = [
      line({ purity: '24k', unitSubtotal: 333.33 }),
      line({ purity: '22k', unitSubtotal: 333.33 }),
      line({ purity: '18k', unitSubtotal: 333.34 }),
    ]
    const totals = finalizeLineCartTotals({ lines, discount: 50, tax: tax5, shippingFee: 25 })
    const lineSum = roundMoney(lines.reduce((s, l) => s + l.breakup.line_total, 0))
    expect(roundMoney(lineSum + totals.shippingFee)).toBe(totals.total)
  })

  it('historical line VAT snapshots ignore later tax setting changes', () => {
    const lines = [line({ purity: '22k', unitSubtotal: 1000 })]
    const placed = finalizeLineCartTotals({ lines, discount: 0, tax: tax5, shippingFee: 0 })
    expect(placed.taxAmount).toBe(50)
    const snapshotVat = lines[0].breakup.vat_amount
    // Changing current tax must not rewrite the saved breakup
    const newTax = { isActive: true, taxPercent: 10, taxMode: 'exclusive', applyOn: 'total' }
    expect(computeVat({
      taxableBase: lines[0].breakup.taxable_base,
      tax: newTax,
      taxTreatment: lines[0].breakup.tax_treatment,
    }).vat_amount).toBe(100)
    expect(snapshotVat).toBe(50)
  })

  it('making_only does not tax zero-rated or exempt making charges', () => {
    const taxMaking = { isActive: true, taxPercent: 5, taxMode: 'exclusive', applyOn: 'making_only' }
    const lines = [
      line({ purity: '24k', unitSubtotal: 1000, making: 100 }),
      line({ purity: '22k', taxTreatment: 'exempt', unitSubtotal: 800, making: 80 }),
      line({ purity: '22k', unitSubtotal: 500, making: 50 }),
    ]
    const totals = finalizeLineCartTotals({ lines, discount: 0, tax: taxMaking, shippingFee: 0 })
    expect(lines[0].breakup.vat_amount).toBe(0)
    expect(lines[1].breakup.vat_amount).toBe(0)
    expect(lines[2].breakup.vat_amount).toBe(2.5)
    expect(totals.taxAmount).toBe(2.5)
  })

  it('shipping is identical with and without a coupon (not added to VAT base)', () => {
    const lines = [line({ purity: '22k', unitSubtotal: 1000 })]
    const without = finalizeLineCartTotals({ lines: [line({ purity: '22k', unitSubtotal: 1000 })], discount: 0, tax: tax5, shippingFee: 25 })
    const withCoupon = finalizeLineCartTotals({ lines, discount: 100, tax: tax5, shippingFee: 25 })
    expect(without.shippingFee).toBe(25)
    expect(withCoupon.shippingFee).toBe(25)
    expect(without.taxAmount).toBe(50)
    expect(withCoupon.taxAmount).toBe(45)
    expect(withCoupon.total).toBe(roundMoney(900 + 45 + 25))
  })
})

describe('calendar-safe scheme months', () => {
  it('clamps end-of-month overflow', () => {
    const jan31 = new Date(Date.UTC(2026, 0, 31, 12, 0, 0))
    const feb = addCalendarMonths(jan31, 1)
    expect(feb.toISOString().slice(0, 10)).toBe('2026-02-28')
    const mar = addCalendarMonths(jan31, 2)
    expect(mar.toISOString().slice(0, 10)).toBe('2026-03-31')
  })

  it('handles leap years', () => {
    const jan31 = new Date(Date.UTC(2024, 0, 31))
    expect(addCalendarMonths(jan31, 1).toISOString().slice(0, 10)).toBe('2024-02-29')
  })

  it('handles November 30 + 3 months', () => {
    const nov30 = new Date(Date.UTC(2025, 10, 30))
    expect(addCalendarMonths(nov30, 3).toISOString().slice(0, 10)).toBe('2026-02-28')
  })
})
