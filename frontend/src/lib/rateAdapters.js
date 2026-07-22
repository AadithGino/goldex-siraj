import { dateTimestamp } from '@/lib/date'

function deriveChangedByName(row) {
  if (row?.changed_by_name) return row.changed_by_name
  const by = row?.created_by
  if (!by || typeof by !== 'object') return null
  return by.full_name || by.email || null
}

function normalizeEffectiveAt(row) {
  return row?.effective_at ?? row?.effective_date ?? row?.created_at ?? null
}

export function normalizeGoldRate(row = {}) {
  return {
    ...row,
    effective_at: normalizeEffectiveAt(row),
    rate_per_gram: row.rate_per_gram,
    changed_by_name: deriveChangedByName(row),
  }
}

export function normalizeStoneRate(row = {}) {
  return {
    ...row,
    effective_at: normalizeEffectiveAt(row),
    rate_per_unit: row.rate_per_unit ?? row.rate,
    changed_by_name: deriveChangedByName(row),
  }
}

export function normalizeGoldRates(rows) {
  return (Array.isArray(rows) ? rows : []).map(normalizeGoldRate)
}

export function normalizeStoneRates(rows) {
  return (Array.isArray(rows) ? rows : []).map(normalizeStoneRate)
}

/** Newest valid effective_at first; invalid/missing timestamps sort last. */
export function compareRatesByEffectiveAt(a, b) {
  const diff = dateTimestamp(b?.effective_at) - dateTimestamp(a?.effective_at)
  if (diff !== 0) return diff
  const createdDiff = dateTimestamp(b?.created_at) - dateTimestamp(a?.created_at)
  if (createdDiff !== 0) return createdDiff
  return String(b?.id || '').localeCompare(String(a?.id || ''))
}

export function rateHistoryKey(row, prefix = 'rate') {
  if (row?.id) return String(row.id)
  return [
    prefix,
    row?.purity || row?.stone_type || 'unknown',
    row?.grade || '',
    row?.unit || '',
    row?.effective_at || row?.created_at || 'no-date',
    row?.rate_per_gram ?? row?.rate_per_unit ?? row?.rate ?? '',
  ].join(':')
}
