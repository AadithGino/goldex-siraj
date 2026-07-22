import { describe, expect, it } from 'vitest'
import { isValidUaeMobile, normalizeUaePhone } from './addressFormat.js'

describe('UAE address phone helpers', () => {
  it('normalizes local, leading-zero, and E.164 forms', () => {
    expect(normalizeUaePhone('501234567')).toBe('501234567')
    expect(normalizeUaePhone('0501234567')).toBe('501234567')
    expect(normalizeUaePhone('+971501234567')).toBe('501234567')
    expect(normalizeUaePhone('971 50 123 4567')).toBe('501234567')
  })

  it('accepts 9-digit mobiles starting with 5', () => {
    expect(isValidUaeMobile('501234567')).toBe(true)
    expect(isValidUaeMobile('521234567')).toBe(true)
    expect(isValidUaeMobile('+971501234567')).toBe(true)
  })

  it('rejects numbers that do not start with 5', () => {
    expect(isValidUaeMobile('123123123')).toBe(false)
    expect(isValidUaeMobile('401234567')).toBe(false)
    expect(isValidUaeMobile('50123456')).toBe(false)
  })
})
