import { describe, expect, it } from 'vitest'
import {
  BUSINESS_UTC_OFFSET,
  dubaiDateTimeLocalFromInstant,
  dubaiDateTimeLocalToIso,
  dubaiDayEndUtc,
  dubaiDayStartUtc,
  dubaiMonthStartYmd,
  dubaiYmd,
  nowDubaiDateTimeLocal,
} from '../src/utils/dubaiTime.js'

describe('Asia/Dubai calendar helpers', () => {
  it('maps Dubai midnight to the correct UTC instant', () => {
    expect(dubaiDayStartUtc('2026-07-20').toISOString()).toBe('2026-07-19T20:00:00.000Z')
    expect(dubaiDayEndUtc('2026-07-20').toISOString()).toBe('2026-07-20T19:59:59.999Z')
  })

  it('formats and derives month start in Dubai', () => {
    const middayUtc = new Date('2026-07-20T08:00:00.000Z') // 12:00 Dubai
    expect(dubaiYmd(middayUtc)).toBe('2026-07-20')
    expect(dubaiMonthStartYmd(middayUtc)).toBe('2026-07-01')

    const beforeDubaiMidnight = new Date('2026-07-19T21:00:00.000Z') // 01:00 Dubai Jul 20
    expect(dubaiYmd(beforeDubaiMidnight)).toBe('2026-07-20')
  })

  it('rejects impossible calendar dates', async () => {
    const { isYmd } = await import('../src/utils/dubaiTime.js')
    expect(isYmd('2026-99-99')).toBe(false)
    expect(isYmd('2026-02-30')).toBe(false)
    expect(isYmd('2026-07-20')).toBe(true)
  })
})

describe('Dubai datetime-local coupon helpers', () => {
  it('round-trips instants without depending on host offset', () => {
    expect(BUSINESS_UTC_OFFSET).toBe('+04:00')
    const iso = '2026-07-21T10:00:00.000Z'
    expect(dubaiDateTimeLocalFromInstant(iso)).toBe('2026-07-21T14:00')
    expect(dubaiDateTimeLocalToIso('2026-07-21T14:00')).toBe(iso)
  })

  it('preserves midnight boundary', () => {
    const iso = '2026-07-20T20:00:00.000Z'
    expect(dubaiDateTimeLocalFromInstant(iso)).toBe('2026-07-21T00:00')
    expect(dubaiDateTimeLocalToIso('2026-07-21T00:00')).toBe(iso)
  })

  it('formats now as Dubai wall clock', () => {
    expect(nowDubaiDateTimeLocal(new Date('2026-07-21T08:30:00.000Z'))).toBe('2026-07-21T12:30')
  })
})
