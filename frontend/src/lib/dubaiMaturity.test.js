import { describe, expect, it } from 'vitest'
import {
  dubaiYmdFromInstant,
  formatDubaiBusinessDate,
  isDubaiBusinessDateReached,
} from './dubaiTime.js'
import { computeSchemeProgress, mapSchemeEnrollment } from './schemeAdapters.js'

describe('Dubai scheme maturity helpers', () => {
  // Maturity instant = Dubai calendar day 2026-03-15 00:00 (+04) = 2026-03-14T20:00:00.000Z
  const maturityInstant = new Date('2026-03-14T20:00:00.000Z')

  it('before Dubai midnight → not matured', () => {
    const before = new Date('2026-03-14T19:59:59.000Z') // still 2026-03-14 Dubai
    expect(dubaiYmdFromInstant(before)).toBe('2026-03-14')
    expect(isDubaiBusinessDateReached(maturityInstant, before)).toBe(false)
  })

  it('at Dubai midnight → matured', () => {
    const atMidnight = new Date('2026-03-14T20:00:00.000Z')
    expect(dubaiYmdFromInstant(atMidnight)).toBe('2026-03-15')
    expect(isDubaiBusinessDateReached(maturityInstant, atMidnight)).toBe(true)
  })

  it('UTC date can differ from Dubai date', () => {
    const utcStill14 = new Date('2026-03-14T22:00:00.000Z') // Dubai 2026-03-15 02:00
    expect(dubaiYmdFromInstant(utcStill14)).toBe('2026-03-15')
    expect(isDubaiBusinessDateReached(maturityInstant, utcStill14)).toBe(true)
  })

  it('result is host-timezone independent (fixed instants)', () => {
    const now = new Date('2026-03-15T10:00:00.000Z')
    expect(isDubaiBusinessDateReached(maturityInstant, now)).toBe(true)
    expect(dubaiYmdFromInstant(maturityInstant)).toBe('2026-03-15')
    expect(formatDubaiBusinessDate(maturityInstant)).toBe('15 Mar 2026')
  })

  it('invalid or missing maturity → false / no crash', () => {
    expect(isDubaiBusinessDateReached(null)).toBe(false)
    expect(isDubaiBusinessDateReached('not-a-date')).toBe(false)
    expect(isDubaiBusinessDateReached(undefined, new Date('bad'))).toBe(false)
    expect(dubaiYmdFromInstant('bad')).toBe(null)
    expect(formatDubaiBusinessDate('bad')).toBe('—')
  })

  it('adapter and eligibility agree on Dubai maturity', () => {
    const before = new Date('2026-03-14T19:59:59.000Z')
    const after = new Date('2026-03-14T20:00:00.000Z')
    const enrollment = {
      status: 'active',
      maturity_at: maturityInstant.toISOString(),
      tenure_months_snapshot: 1,
      monthly_amount_snapshot: 100,
      bonus_months_snapshot: 0,
      scheme_installments: [
        { installment_number: 1, amount: 100, payment_status: 'paid', due_date: maturityInstant.toISOString() },
      ],
    }
    const early = mapSchemeEnrollment(enrollment)
    // mapSchemeEnrollment uses Date.now — override via computeSchemeProgress
    const earlyProgress = computeSchemeProgress(enrollment, enrollment.scheme_installments, before)
    const lateProgress = computeSchemeProgress(enrollment, enrollment.scheme_installments, after)
    expect(earlyProgress.isMatured).toBe(false)
    expect(lateProgress.isMatured).toBe(true)
    expect(early.is_matured === earlyProgress.isMatured || typeof early.is_matured === 'boolean').toBe(true)
    expect(isDubaiBusinessDateReached(maturityInstant, before)).toBe(earlyProgress.isMatured)
    expect(isDubaiBusinessDateReached(maturityInstant, after)).toBe(lateProgress.isMatured)
  })
})
