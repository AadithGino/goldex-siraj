import { describe, expect, it } from 'vitest'
import {
  BUSINESS_UTC_OFFSET,
  dubaiDateTimeLocalFromInstant,
  dubaiDateTimeLocalToIso,
  nowDubaiDateTimeLocal,
} from './dubaiTime'
import {
  CouponPayloadError,
  couponToFormState,
  toCouponPayload,
} from './couponPayload'

describe('Dubai coupon datetime helpers (host-TZ independent)', () => {
  it('round-trips UTC instant through Dubai datetime-local', () => {
    const iso = '2026-07-21T10:00:00.000Z' // 14:00 Dubai
    const local = dubaiDateTimeLocalFromInstant(iso)
    expect(local).toBe('2026-07-21T14:00')
    expect(dubaiDateTimeLocalToIso(local)).toBe(iso)
  })

  it('handles Dubai midnight / UTC date boundary', () => {
    const iso = '2026-07-20T20:00:00.000Z' // midnight Jul 21 Dubai
    const local = dubaiDateTimeLocalFromInstant(iso)
    expect(local).toBe('2026-07-21T00:00')
    expect(dubaiDateTimeLocalToIso(local)).toBe(iso)
  })

  it('default valid_from matches current Dubai wall time', () => {
    const fixed = new Date('2026-07-21T08:30:00.000Z') // 12:30 Dubai
    expect(nowDubaiDateTimeLocal(fixed)).toBe('2026-07-21T12:30')
    const form = couponToFormState(null)
    // Form default uses live now — shape check only
    expect(form.valid_from).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it('edit form round-trip does not shift stored instants', () => {
    const coupon = {
      id: 'c1',
      code: 'SAVE',
      discount_type: 'percent',
      discount_value: 10,
      min_order: 0,
      max_discount: null,
      usage_limit: null,
      per_customer_limit: 1,
      is_active: true,
      valid_from: '2026-07-21T10:00:00.000Z',
      valid_to: '2026-07-28T19:59:00.000Z',
    }
    const form = couponToFormState(coupon)
    const payload = toCouponPayload(form)
    expect(payload.valid_from).toBe(coupon.valid_from)
    expect(payload.valid_to).toBe(coupon.valid_to)
  })

  it('uses centralized Dubai offset constant', () => {
    expect(BUSINESS_UTC_OFFSET).toBe('+04:00')
  })
})

describe('toCouponPayload strict validation', () => {
  const base = {
    code: 'SAVE10',
    discount_type: 'percent',
    discount_value: 10,
    min_order: 0,
    max_discount: '',
    usage_limit: '',
    per_customer_limit: 1,
    valid_from: '2026-07-21T14:00',
    valid_to: '',
    is_active: true,
  }

  it('emits ISO from Dubai wall time and preserves is_active false', () => {
    const payload = toCouponPayload({ ...base, is_active: false })
    expect(payload.valid_from).toBe('2026-07-21T10:00:00.000Z')
    expect(payload.valid_to).toBeNull()
    expect(payload.is_active).toBe(false)
    expect(payload.usage_limit).toBeNull()
  })

  it('rejects NaN / invalid discount and decimal integers', () => {
    expect(() => toCouponPayload({ ...base, discount_value: 'abc' })).toThrow(CouponPayloadError)
    expect(() => toCouponPayload({ ...base, usage_limit: '1.9' })).toThrow(/whole number/)
    expect(() => toCouponPayload({ ...base, per_customer_limit: '2.5' })).toThrow(/whole number/)
    expect(() => toCouponPayload({ ...base, min_order: 'nope' })).toThrow(CouponPayloadError)
    expect(() => toCouponPayload({ ...base, discount_value: 150 })).toThrow(/100/)
  })

  it('does not silently replace invalid min_order with 0', () => {
    expect(() => toCouponPayload({ ...base, min_order: 'xyz' })).toThrow(/Minimum order/)
  })
})
