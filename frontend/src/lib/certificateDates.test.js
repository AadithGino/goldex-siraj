import { describe, expect, it } from 'vitest'
import { formatCertificateIssuedDate } from './certificateDates.js'
import { dubaiYmdFromInstant } from './dubaiTime.js'

describe('formatCertificateIssuedDate (Dubai YYYY-MM-DD)', () => {
  it('UTC/Dubai boundary keeps admin calendar day', () => {
    // Admin entered 2026-03-15 → stored as Dubai day start = 2026-03-14T20:00:00.000Z
    const issued = '2026-03-14T20:00:00.000Z'
    expect(dubaiYmdFromInstant(issued)).toBe('2026-03-15')
    expect(formatCertificateIssuedDate(issued)).toBe('2026-03-15')
  })

  it('host timezone must not change displayed day (fixed instants)', () => {
    const nearMidnightUtc = '2026-03-14T22:00:00.000Z' // Dubai 2026-03-15 02:00
    expect(formatCertificateIssuedDate(nearMidnightUtc)).toBe('2026-03-15')
    // Same instant regardless of process TZ — helper uses Asia/Dubai explicitly
    expect(formatCertificateIssuedDate(new Date(nearMidnightUtc))).toBe('2026-03-15')
  })

  it('invalid date → safe fallback, no throw', () => {
    expect(formatCertificateIssuedDate('not-a-date')).toBe('—')
    expect(formatCertificateIssuedDate('bad', 'n/a')).toBe('n/a')
  })

  it('missing date → safe fallback, no throw', () => {
    expect(formatCertificateIssuedDate(null)).toBe('—')
    expect(formatCertificateIssuedDate(undefined)).toBe('—')
    expect(formatCertificateIssuedDate('')).toBe('—')
  })
})
