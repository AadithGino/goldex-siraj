import { describe, expect, it } from 'vitest'
import {
  compareRatesByEffectiveAt,
  normalizeGoldRate,
  normalizeGoldRates,
  normalizeStoneRate,
} from './rateAdapters.js'

describe('rate adapters', () => {
  it('keeps effective_at and derives changed_by_name from created_by.full_name', () => {
    const gold = normalizeGoldRate({
      id: 'g1',
      purity: '22k',
      rate_per_gram: 250,
      effective_at: '2026-07-20T10:00:00.000Z',
      created_by: { full_name: 'Asha Manager', email: 'asha@example.com' },
    })
    expect(gold.effective_at).toBe('2026-07-20T10:00:00.000Z')
    expect(gold.changed_by_name).toBe('Asha Manager')
  })

  it('normalizes legacy effective_date to effective_at', () => {
    const gold = normalizeGoldRate({
      id: 'g2',
      effective_date: '2026-06-01T00:00:00.000Z',
      rate_per_gram: 200,
    })
    expect(gold.effective_at).toBe('2026-06-01T00:00:00.000Z')
  })

  it('falls back to created_at when effective fields are absent', () => {
    const gold = normalizeGoldRate({
      id: 'g3',
      created_at: '2026-05-01T00:00:00.000Z',
      rate_per_gram: 180,
    })
    expect(gold.effective_at).toBe('2026-05-01T00:00:00.000Z')
  })

  it('normalizes stone rate_per_unit from rate', () => {
    const stone = normalizeStoneRate({
      id: 's1',
      stone_type: 'diamond',
      grade: 'VS',
      unit: 'carat',
      rate: 1200,
      effective_at: '2026-07-18T08:00:00.000Z',
      created_by: { email: 'staff@example.com' },
    })
    expect(stone.rate_per_unit).toBe(1200)
    expect(stone.changed_by_name).toBe('staff@example.com')
    expect(stone.effective_at).toBe('2026-07-18T08:00:00.000Z')
  })

  it('sorts newest valid dates first and invalid/missing dates after', () => {
    const sorted = normalizeGoldRates([
      { id: 'old', effective_at: '2026-01-01T00:00:00.000Z' },
      { id: 'bad', effective_at: 'not-a-date' },
      { id: 'missing' },
      { id: 'new', effective_at: '2026-07-20T00:00:00.000Z' },
      { id: 'mid', effective_date: '2026-03-01T00:00:00.000Z' },
    ]).sort(compareRatesByEffectiveAt)

    expect(sorted.slice(0, 3).map((row) => row.id)).toEqual(['new', 'mid', 'old'])
    expect(sorted.slice(3).map((row) => row.id).sort()).toEqual(['bad', 'missing'])
  })
})
