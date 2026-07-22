import { z } from 'zod'

function valuesEqual(a, b) {
  if (a === b) return true
  if (a == null && b == null) return true
  if (typeof a === 'string' && typeof b === 'string' && a.trim() === b.trim()) return true
  if (typeof a === 'number' && typeof b === 'number' && Number(a) === Number(b)) return true
  if (typeof a === 'boolean' && typeof b === 'boolean' && a === b) return true
  if (Array.isArray(a) && Array.isArray(b) && JSON.stringify(a) === JSON.stringify(b)) return true
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (a instanceof Date && typeof b === 'string') {
    const bd = new Date(b)
    return !Number.isNaN(bd.getTime()) && a.getTime() === bd.getTime()
  }
  if (b instanceof Date && typeof a === 'string') {
    const ad = new Date(a)
    return !Number.isNaN(ad.getTime()) && b.getTime() === ad.getTime()
  }
  return false
}

/**
 * Resolve any of several alias keys to a single value.
 * Rejects when two present keys disagree.
 * @returns {{ present: boolean, value: unknown, key: string|null }}
 */
export function resolveAliasGroup(body, keys) {
  const present = keys.filter((key) => Object.prototype.hasOwnProperty.call(body, key))
  if (!present.length) return { present: false, value: undefined, key: null }
  const firstKey = present[0]
  const firstVal = body[firstKey]
  for (let i = 1; i < present.length; i += 1) {
    const key = present[i]
    if (!valuesEqual(firstVal, body[key])) {
      throw new z.ZodError([{
        code: 'custom',
        message: `${present.join(' / ')} must match when more than one is sent`,
        path: [firstKey],
      }])
    }
  }
  return { present: true, value: firstVal, key: firstKey }
}

/**
 * Resolve snake_case / camelCase alias pairs.
 * Rejects when both are present with conflicting values.
 * @returns {{ present: boolean, value: unknown }}
 */
export function resolveFieldAlias(body, snakeKey, camelKey) {
  return resolveAliasGroup(body, [snakeKey, camelKey])
}

/**
 * Build a normalized object with only snake_case keys from alias pairs.
 * @param {object} body
 * @param {Array<[string, string]>} pairs [snake, camel]
 */
export function pickNormalizedAliases(body, pairs) {
  const out = {}
  for (const [snake, camel] of pairs) {
    const { present, value } = resolveFieldAlias(body, snake, camel)
    if (present) out[snake] = value
  }
  return out
}
