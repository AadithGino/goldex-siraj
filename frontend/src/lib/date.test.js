import { describe, expect, it } from 'vitest'
import { dateTimestamp, formatDateSafe, parseDateSafe } from './date.js'

describe('date helpers', () => {
  it('parses ISO strings, Dates and timestamps', () => {
    expect(parseDateSafe('2026-07-20T10:00:00.000Z')?.toISOString()).toBe('2026-07-20T10:00:00.000Z')
    expect(parseDateSafe(new Date('2026-07-20T10:00:00.000Z'))?.toISOString()).toBe('2026-07-20T10:00:00.000Z')
    expect(parseDateSafe(Date.parse('2026-07-20T10:00:00.000Z'))?.toISOString()).toBe('2026-07-20T10:00:00.000Z')
  })

  it('rejects null, undefined, empty and invalid dates', () => {
    expect(parseDateSafe(null)).toBeNull()
    expect(parseDateSafe(undefined)).toBeNull()
    expect(parseDateSafe('')).toBeNull()
    expect(parseDateSafe('bad-date')).toBeNull()
    expect(parseDateSafe(new Date('invalid'))).toBeNull()
  })

  it('formats safely without throwing', () => {
    expect(formatDateSafe('2026-07-20T10:00:00.000Z', 'dd MMM yyyy')).toBe('20 Jul 2026')
    expect(formatDateSafe(undefined, 'dd MMM yyyy')).toBe('—')
    expect(formatDateSafe('bad-date', 'dd MMM yyyy')).toBe('—')
    expect(formatDateSafe(null, 'dd MMM yyyy', 'n/a')).toBe('n/a')
  })

  it('returns safe timestamps for sorting', () => {
    expect(dateTimestamp('2026-07-20T10:00:00.000Z')).toBe(Date.parse('2026-07-20T10:00:00.000Z'))
    expect(dateTimestamp(undefined)).toBe(0)
    expect(dateTimestamp('bad-date', -1)).toBe(-1)
  })
})
