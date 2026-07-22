/**
 * Calendar-safe month arithmetic in UTC calendar space (day clamped to month end).
 * Jan 31 + 1 month → last day of February (UTC).
 *
 * @param {Date|string|number} date
 * @param {number} months integer months to add (may be negative)
 * @returns {Date}
 */
export function addCalendarMonths(date, months) {
  const start = new Date(date)
  if (Number.isNaN(start.getTime())) throw new TypeError('Invalid date for addCalendarMonths')
  const delta = Number(months)
  if (!Number.isFinite(delta) || !Number.isInteger(delta)) {
    throw new TypeError('months must be a finite integer')
  }

  const year = start.getUTCFullYear()
  const month = start.getUTCMonth()
  const day = start.getUTCDate()
  const hours = start.getUTCHours()
  const minutes = start.getUTCMinutes()
  const seconds = start.getUTCSeconds()
  const ms = start.getUTCMilliseconds()

  const targetMonthIndex = month + delta
  const targetYear = year + Math.floor(targetMonthIndex / 12)
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12

  // Day 0 of next month = last day of target month
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate()
  const clampedDay = Math.min(day, lastDay)

  return new Date(Date.UTC(targetYear, normalizedMonth, clampedDay, hours, minutes, seconds, ms))
}
