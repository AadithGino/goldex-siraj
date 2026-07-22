import { describe, expect, it } from 'vitest'
import { calculateBreakup, computeVat, assertMetalWeights } from '../src/services/pricingCalculator.js'
import { AppError } from '../src/utils/AppError.js'

const product = { wastagePercent: 5, makingChargeType: 'percent', makingChargeValue: 10, taxTreatment: 'standard' }
const taxTotal = { isActive: true, taxPercent: 5, taxMode: 'exclusive', applyOn: 'total' }
const taxMaking = { isActive: true, taxPercent: 5, taxMode: 'exclusive', applyOn: 'making_only' }
const taxInclusive = { isActive: true, taxPercent: 5, taxMode: 'inclusive', applyOn: 'total' }

describe('metal weight invariant', () => {
  it('rejects non-positive, non-finite, and effective>gross weights', () => {
    expect(() => assertMetalWeights({ weightGrams: 0, effectiveWeight: 0 })).toThrow(AppError)
    expect(() => assertMetalWeights({ weightGrams: 10, effectiveWeight: 11 })).toThrow(/EFFECTIVE_WEIGHT_EXCEEDS_GROSS|exceed/)
    expect(() => assertMetalWeights({ weightGrams: Number.NaN, effectiveWeight: 1 })).toThrow(AppError)
    expect(assertMetalWeights({ weightGrams: 10, effectiveWeight: 8 })).toMatchObject({
      gross_weight: 10,
      effective_weight: 8,
      net_weight: 8,
    })
  })
})

describe('VAT helper', () => {
  it('respects making_only, inclusive, and exempt treatments', () => {
    expect(computeVat({ taxableBase: 100, tax: taxMaking, taxTreatment: 'standard' }).vat_amount).toBe(5)
    expect(computeVat({ taxableBase: 105, tax: taxInclusive, taxTreatment: 'standard' }).vat_amount).toBe(5)
    expect(computeVat({ taxableBase: 100, tax: taxTotal, taxTreatment: 'exempt' }).vat_amount).toBe(0)
  })
})

describe('gold and stone pricing calculator', () => {
  it('recalculates COD using the handover rate even when a fixed estimate exists', () => {
    const variant = { weightGrams: 10, effectiveWeight: 10, makingCharge: 0, stoneCharge: 50, fixedPrice: 999 }
    const placed = calculateBreakup({ variant, product, tax: taxTotal, goldRate: 200, ignoreFixedPrice: true })
    const handedOver = calculateBreakup({ variant, product, tax: taxTotal, goldRate: 250, ignoreFixedPrice: true })
    expect(placed.total).not.toBe(handedOver.total)
    expect(handedOver.gold_value).toBe(2500)
    expect(handedOver.total).toBe(3071.25)
  })

  it('uses a fixed price only outside delivery-time repricing', () => {
    const variant = { weightGrams: 10, effectiveWeight: 10, makingCharge: 0, stoneCharge: 50, fixedPrice: 999 }
    expect(calculateBreakup({ variant, product, tax: taxTotal, goldRate: 250 }).total).toBe(1048.95)
  })

  it('prices a carat-rated stone via stone_breakup and ignores stale variant.stoneCharge', () => {
    const variant = { weightGrams: 5, effectiveWeight: 5, makingCharge: 0, stoneCharge: 9999 }
    const stoneBreakup = [{
      product_stone_id: 's1',
      stone_type: 'diamond',
      grade: 'VS',
      unit: 'carat',
      stone_count: 1,
      stone_weight: 0.5,
      rate: 1000,
      amount: 500,
    }]
    const result = calculateBreakup({
      variant,
      product: { ...product, wastagePercent: 0, makingChargeValue: 0 },
      tax: { isActive: false },
      goldRate: 200,
      stoneBreakup,
    })
    expect(result.stone_charge).toBe(500)
    expect(result.stone_breakup).toHaveLength(1)
    expect(result.gold_value).toBe(1000)
    expect(result.total).toBe(1500)
  })

  it('sums multiple stones and piece-rated stones', () => {
    const variant = { weightGrams: 2, effectiveWeight: 2, makingCharge: 0, stoneCharge: 0 }
    const stoneBreakup = [
      { product_stone_id: 'a', stone_type: 'diamond', grade: 'VS', unit: 'carat', stone_count: 1, stone_weight: 0.2, rate: 2000, amount: 400 },
      { product_stone_id: 'b', stone_type: 'ruby', grade: 'A', unit: 'piece', stone_count: 3, stone_weight: 0, rate: 50, amount: 150 },
    ]
    const result = calculateBreakup({
      variant,
      product: { ...product, wastagePercent: 0, makingChargeValue: 0 },
      tax: { isActive: false },
      goldRate: 100,
      stoneBreakup,
    })
    expect(result.stone_charge).toBe(550)
    expect(result.total).toBe(750)
  })

  it('applies making_only VAT to making charge only', () => {
    const variant = { weightGrams: 10, effectiveWeight: 10, makingCharge: 0, stoneCharge: 0 }
    const result = calculateBreakup({
      variant,
      product: { wastagePercent: 0, makingChargeType: 'flat', makingChargeValue: 100, taxTreatment: 'standard' },
      tax: taxMaking,
      goldRate: 200,
    })
    // gold 2000 + making 100 = 2100; VAT 5% of making only = 5; total 2105
    expect(result.making_charge).toBe(100)
    expect(result.unit_vat_amount).toBe(5)
    expect(result.total).toBe(2105)
  })

  it('applies total VAT and inclusive VAT', () => {
    const variant = { weightGrams: 10, effectiveWeight: 10, makingCharge: 0, stoneCharge: 0 }
    const exclusive = calculateBreakup({
      variant,
      product: { wastagePercent: 0, makingChargeType: 'flat', makingChargeValue: 0, taxTreatment: 'standard' },
      tax: taxTotal,
      goldRate: 100,
    })
    expect(exclusive.total).toBe(1050)

    const inclusive = calculateBreakup({
      variant,
      product: { wastagePercent: 0, makingChargeType: 'flat', makingChargeValue: 0, taxTreatment: 'standard' },
      tax: taxInclusive,
      goldRate: 100,
    })
    expect(inclusive.total).toBe(1000)
    expect(inclusive.vat_amount).toBe(47.62)
  })

  it('skips VAT for exempt products', () => {
    const variant = { weightGrams: 10, effectiveWeight: 10, makingCharge: 0, stoneCharge: 0 }
    const result = calculateBreakup({
      variant,
      product: { wastagePercent: 0, makingChargeType: 'flat', makingChargeValue: 0, taxTreatment: 'exempt' },
      tax: taxTotal,
      goldRate: 100,
    })
    expect(result.vat_amount).toBe(0)
    expect(result.total).toBe(1000)
  })
})
