import { describe, expect, it } from 'vitest'
import {
  branchMapsUrl,
  emptyStoreBranch,
  formatBranchAddressLines,
  normalizeStoreBranches,
  primaryAddressFromBranches,
  toStoreBranchesPayload,
} from './storeBranches'

describe('normalizeStoreBranches', () => {
  it('uses saved branches when present', () => {
    const branches = normalizeStoreBranches({
      branches: [
        { name: 'Dubai Mall', line1: 'Fashion Avenue', emirate: 'Dubai', is_primary: true },
        { name: 'Abu Dhabi', line1: 'Yas Mall', emirate: 'Abu Dhabi' },
      ],
    })
    expect(branches).toHaveLength(2)
    expect(branches[0].name).toBe('Dubai Mall')
    expect(branches[0].is_primary).toBe(true)
    expect(branches[1].is_primary).toBe(false)
  })

  it('falls back to the legacy single address', () => {
    const branches = normalizeStoreBranches({
      store_name: 'Goldex',
      address: { line1: 'Gold Souk', city: 'Deira', emirate: 'Dubai' },
    })
    expect(branches).toHaveLength(1)
    expect(branches[0].name).toBe('Goldex')
    expect(branches[0].line1).toBe('Gold Souk')
    expect(branches[0].is_primary).toBe(true)
  })

  it('returns empty when nothing is configured', () => {
    expect(normalizeStoreBranches({})).toEqual([])
    expect(normalizeStoreBranches({ address: {} })).toEqual([])
  })
})

describe('toStoreBranchesPayload', () => {
  it('drops unnamed rows and marks a flagship', () => {
    const payload = toStoreBranchesPayload([
      emptyStoreBranch({ name: '', line1: 'Ignored' }),
      emptyStoreBranch({ name: 'Sharjah', line1: 'Sahara Centre' }),
    ])
    expect(payload).toHaveLength(1)
    expect(payload[0].name).toBe('Sharjah')
    expect(payload[0].is_primary).toBe(true)
  })
})

describe('branch address helpers', () => {
  it('formats lines without duplicating city and emirate', () => {
    expect(formatBranchAddressLines({
      line1: 'Dubai Mall',
      city: 'Dubai',
      emirate: 'Dubai',
      country: 'United Arab Emirates',
    })).toEqual(['Dubai Mall', 'Dubai', 'United Arab Emirates'])
  })

  it('uses a custom maps URL when it is http(s)', () => {
    expect(branchMapsUrl({ maps_url: 'https://maps.app.goo.gl/abc', line1: 'X' }))
      .toBe('https://maps.app.goo.gl/abc')
  })

  it('builds a Google Maps search URL from the address', () => {
    const url = branchMapsUrl({ line1: 'Gold Souk', emirate: 'Dubai' })
    expect(url).toContain('https://www.google.com/maps/search/')
    expect(url).toContain(encodeURIComponent('Gold Souk, Dubai'))
  })

  it('syncs the primary address for invoices', () => {
    expect(primaryAddressFromBranches([
      { name: 'A', line1: 'One', is_primary: false },
      { name: 'B', line1: 'Two', city: 'Dubai', is_primary: true },
    ])).toEqual({
      line1: 'Two',
      line2: '',
      city: 'Dubai',
      emirate: '',
      country: 'United Arab Emirates',
    })
  })
})
