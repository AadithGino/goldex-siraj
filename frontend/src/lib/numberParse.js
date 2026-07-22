/**
 * Explicit numeric parsers for variant/stone payloads.
 * Invalid/blank values throw — never silently coerce to 0/defaults.
 */

export class PayloadValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PayloadValidationError'
  }
}

export function parseOptionalNumber(value, field, { allowZero = true, integer = false, min = null } = {}) {
  if (value === '' || value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(n)) throw new PayloadValidationError(`${field} must be a valid number`)
  if (integer && !Number.isInteger(n)) throw new PayloadValidationError(`${field} must be an integer`)
  if (!allowZero && n === 0) throw new PayloadValidationError(`${field} must not be zero`)
  if (min != null && n < min) throw new PayloadValidationError(`${field} must be ≥ ${min}`)
  return n
}

export function parseRequiredNumber(value, field, opts = {}) {
  if (value === '' || value === null || value === undefined) {
    throw new PayloadValidationError(`${field} is required`)
  }
  const n = parseOptionalNumber(value, field, opts)
  if (n == null) throw new PayloadValidationError(`${field} is required`)
  return n
}

/** Preserve 0; only fall back when null/undefined/blank. */
export function parseLowStockThreshold(value, fallback = 2) {
  if (value === '' || value === null || value === undefined) return fallback
  return parseRequiredNumber(value, 'low_stock_threshold', { integer: true, min: 0, allowZero: true })
}
