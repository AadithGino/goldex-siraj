import { AppError } from './AppError.js'

/** Canonical purity values stored in MongoDB / gold rates. */
export const CANONICAL_PURITIES = Object.freeze(['14k', '18k', '21k', '22k', '24k'])

const ALIAS_TO_CANONICAL = new Map([
  ['14', '14k'], ['14k', '14k'], ['14kt', '14k'], ['14 karat', '14k'], ['14karat', '14k'],
  ['18', '18k'], ['18k', '18k'], ['18kt', '18k'], ['18 karat', '18k'], ['18karat', '18k'],
  ['21', '21k'], ['21k', '21k'], ['21kt', '21k'], ['21 karat', '21k'], ['21karat', '21k'],
  ['22', '22k'], ['22k', '22k'], ['22kt', '22k'], ['22 karat', '22k'], ['22karat', '22k'],
  ['24', '24k'], ['24k', '24k'], ['24kt', '24k'], ['24 karat', '24k'], ['24karat', '24k'],
])

/**
 * Normalize purity labels to canonical lowercase keys (e.g. 24K / 24KT / 24 → 24k).
 * @param {unknown} input
 * @param {{ optional?: boolean }} [opts]
 * @returns {string|null}
 */
export function normalizePurity(input, opts = {}) {
  if (input == null || input === '') {
    if (opts.optional) return null
    throw new AppError(422, 'INVALID_PURITY', 'Purity is required')
  }
  if (typeof input === 'number' && Number.isFinite(input)) {
    return normalizePurity(String(Math.trunc(input)), opts)
  }
  const key = String(input).trim().toLowerCase().replace(/\s+/g, ' ')
  const canonical = ALIAS_TO_CANONICAL.get(key)
  if (!canonical) {
    throw new AppError(422, 'INVALID_PURITY', `Unsupported purity value: ${input}`)
  }
  return canonical
}

/** Display form preferred in invoices (e.g. 24K). */
export function displayPurity(canonical) {
  if (!canonical) return null
  return String(canonical).toUpperCase().replace(/K$/, 'K')
}

/**
 * Resolve immutable tax treatment for a line.
 * Eligible 24KT is always zero_rated (never exempt).
 */
export function resolveTaxTreatment(purity, taxTreatment) {
  let treatment = taxTreatment || 'standard'
  if (treatment === 'investment_precious_metal_zero_rated') treatment = 'zero_rated'

  let canonical = null
  try {
    canonical = normalizePurity(purity, { optional: true })
  } catch {
    canonical = null
  }

  if (canonical === '24k' || treatment === 'zero_rated') {
    return 'zero_rated'
  }
  if (treatment === 'exempt') return 'exempt'
  return 'standard'
}

export function isZeroRatedTreatment(treatment) {
  return treatment === 'zero_rated' || treatment === 'investment_precious_metal_zero_rated'
}
