/** Certificate issued-date display via Dubai business calendar (host-TZ independent). */
import { dubaiYmdFromInstant } from './dubaiTime.js'

/**
 * Display certificate `issued_date` as the Dubai YYYY-MM-DD calendar day.
 * Does not alter the stored instant. Invalid/missing → fallback (no throw).
 */
export function formatCertificateIssuedDate(value, fallback = '—') {
  if (value == null || value === '') return fallback
  const ymd = dubaiYmdFromInstant(value)
  return ymd || fallback
}
