/**
 * Safe numeric parsing for Zod — blank strings must NOT coerce to 0.
 */
import { z } from 'zod'

/** Reject blank string; otherwise pass through for number schema. */
export function finiteNumber(schema) {
  return z.preprocess((value, ctx) => {
    if (value === '' || (typeof value === 'string' && value.trim() === '')) {
      ctx.addIssue({ code: 'custom', message: 'Numeric field must not be blank' })
      return z.NEVER
    }
    if (value === null || value === undefined) return value
    return value
  }, schema)
}

export function optionalFiniteNumber(schema) {
  return z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) return undefined
    if (typeof value === 'string' && value.trim() === '') return undefined
    return value
  }, schema.optional())
}

/** Stable JSON for idempotency hashes (key-order independent). */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}
