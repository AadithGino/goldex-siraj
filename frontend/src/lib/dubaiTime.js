/** Business calendar helpers for Asia/Dubai (UTC+4, no DST). Host-timezone independent. */
export const BUSINESS_TIMEZONE = 'Asia/Dubai'
export const BUSINESS_UTC_OFFSET = '+04:00'

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

export function isYmd(value) {
  if (typeof value !== 'string' || !YMD_RE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/**
 * Format an instant as `YYYY-MM-DDTHH:mm` in Asia/Dubai wall time
 * for `<input type="datetime-local">`.
 */
export function dubaiDateTimeLocalFromInstant(value) {
  if (value == null || value === '') return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/**
 * Convert Dubai datetime-local wall time to an explicit UTC ISO instant.
 */
export function dubaiDateTimeLocalToIso(value) {
  if (value == null || value === '') return null
  const raw = String(value).trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(raw)) {
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) throw new Error('Invalid date')
    return date.toISOString()
  }
  const match = DATETIME_LOCAL_RE.exec(raw)
  if (!match) throw new Error('Invalid datetime-local value')
  const [, y, mo, d, h, mi, s = '00'] = match
  if (!isYmd(`${y}-${mo}-${d}`)) throw new Error('Invalid datetime-local value')
  const hh = Number(h)
  const mm = Number(mi)
  const ss = Number(s)
  if (hh > 23 || mm > 59 || ss > 59) throw new Error('Invalid datetime-local value')
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${String(ss).padStart(2, '0')}.000${BUSINESS_UTC_OFFSET}`)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date')
  return date.toISOString()
}

export function nowDubaiDateTimeLocal(now = new Date()) {
  return dubaiDateTimeLocalFromInstant(now)
}

/**
 * Calendar `YYYY-MM-DD` in Asia/Dubai for an instant.
 * Host-timezone independent. Invalid/missing → null.
 */
export function dubaiYmdFromInstant(value) {
  if (value == null || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * True when the Dubai calendar day of `now` is on/after the Dubai calendar day of `target`.
 * Matches backend `dubaiYmd()` maturity semantics. Never throws.
 */
export function isDubaiBusinessDateReached(target, now = new Date()) {
  const targetYmd = dubaiYmdFromInstant(target)
  if (!targetYmd) return false
  const nowYmd = dubaiYmdFromInstant(now)
  if (!nowYmd) return false
  return nowYmd >= targetYmd
}

/** Format an instant as a Dubai business calendar date for display (dd MMM yyyy). */
export function formatDubaiBusinessDate(value, fallback = '—') {
  const ymd = dubaiYmdFromInstant(value)
  if (!ymd || !isYmd(ymd)) return fallback
  const [y, m, d] = ymd.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`
}

