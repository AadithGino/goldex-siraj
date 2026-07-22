import { format, isValid } from 'date-fns'

/**
 * Parse API/local date values safely.
 * Accepts ISO strings, Date instances, and numeric timestamps.
 */
export function parseDateSafe(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) return isValid(value) ? value : null

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    const date = new Date(value)
    return isValid(date) ? date : null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const date = new Date(trimmed)
    return isValid(date) ? date : null
  }

  return null
}

/** Format a date without throwing. Returns fallback for missing/invalid values. */
export function formatDateSafe(value, pattern, fallback = '—') {
  const date = parseDateSafe(value)
  if (!date) return fallback
  try {
    if (!isValid(date)) return fallback
    return format(date, pattern)
  } catch {
    return fallback
  }
}

/** Numeric timestamp for sorting. Invalid/missing values use fallback (default 0). */
export function dateTimestamp(value, fallback = 0) {
  const date = parseDateSafe(value)
  if (!date) return fallback
  const time = date.getTime()
  return Number.isFinite(time) ? time : fallback
}
