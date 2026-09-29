import { describe, expect, it } from 'vitest'
import { tabbyInstallmentEstimate } from '@/lib/tabby'

describe('tabbyInstallmentEstimate', () => {
  it('returns null for invalid amounts', () => {
    expect(tabbyInstallmentEstimate(0)).toBeNull()
    expect(tabbyInstallmentEstimate(-1)).toBeNull()
    expect(tabbyInstallmentEstimate('x')).toBeNull()
  })

  it('uses Tabby 4-pay formula (total × 1.015 / 4)', () => {
    expect(tabbyInstallmentEstimate(1000)).toBe(253.75)
    expect(tabbyInstallmentEstimate(2000)).toBe(507.5)
  })
})
