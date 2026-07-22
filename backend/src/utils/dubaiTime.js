/** Business calendar helpers for Asia/Dubai (UTC+4, no DST). */
export const BUSINESS_TIMEZONE = 'Asia/Dubai'
/** Fixed offset for Asia/Dubai — no DST. Prefer this over host-local offsets. */
export const BUSINESS_UTC_OFFSET = '+04:00'

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

/** True only for real Gregorian calendar dates in YYYY-MM-DD form. */
export function isYmd(value) {
  if (typeof value !== 'string' || !YMD_RE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** Calendar YYYY-MM-DD in Asia/Dubai for an instant. */
export function dubaiYmd(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Start of Dubai calendar day as UTC Date. */
export function dubaiDayStartUtc(ymd) {
  if (!isYmd(ymd)) throw new Error(`Invalid YMD: ${ymd}`)
  return new Date(`${ymd}T00:00:00.000${BUSINESS_UTC_OFFSET}`)
}

/** Inclusive end of Dubai calendar day as UTC Date. */
export function dubaiDayEndUtc(ymd) {
  if (!isYmd(ymd)) throw new Error(`Invalid YMD: ${ymd}`)
  return new Date(`${ymd}T23:59:59.999${BUSINESS_UTC_OFFSET}`)
}

/** First calendar day of the Dubai month containing `date`. */
export function dubaiMonthStartYmd(date = new Date()) {
  const ymd = dubaiYmd(date)
  return `${ymd.slice(0, 7)}-01`
}

/**
 * Inclusive paidAt range for Dubai calendar dates.
 * @returns {{ fromUtc: Date|null, toUtc: Date|null }}
 */
export function dubaiPaidAtRange(from, to) {
  return {
    fromUtc: from ? dubaiDayStartUtc(from) : null,
    toUtc: to ? dubaiDayEndUtc(to) : null,
  }
}

/**
 * Format an instant as `YYYY-MM-DDTHH:mm` in Asia/Dubai wall time
 * for `<input type="datetime-local">`. Independent of host timezone.
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
 * Does not use the host timezone — appends BUSINESS_UTC_OFFSET.
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

/** Current Asia/Dubai wall time as datetime-local text. */
export function nowDubaiDateTimeLocal(now = new Date()) {
  return dubaiDateTimeLocalFromInstant(now)
}
