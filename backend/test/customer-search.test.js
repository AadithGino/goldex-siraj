import { describe, expect, it } from 'vitest'
import { buildCustomerSearchFilter } from '../src/utils/customerSearch.js'

describe('buildCustomerSearchFilter', () => {
  it('returns null for empty search', () => {
    expect(buildCustomerSearchFilter('')).toBeNull()
    expect(buildCustomerSearchFilter('   ')).toBeNull()
  })

  it('matches name substring case-insensitively', () => {
    const filter = buildCustomerSearchFilter('scheme buyer')
    expect(filter.$or.some((clause) => clause.fullName)).toBe(true)
    expect(filter.$or[0].fullName.test('Scheme Buyer')).toBe(true)
  })

  it('matches phone digits in order with flexible separators', () => {
    const filter = buildCustomerSearchFilter('501 888')
    const phoneClauses = filter.$or.filter((clause) => clause.phone)
    expect(phoneClauses.length).toBeGreaterThan(0)
    expect(phoneClauses.some((clause) => clause.phone.test('+971501888001'))).toBe(true)
    expect(phoneClauses.some((clause) => clause.phone.test('+971-50-1888-001'))).toBe(true)
  })

  it('tokenizes multi-word names', () => {
    const filter = buildCustomerSearchFilter('john doe')
    const andClause = filter.$or.find((clause) => clause.$and)
    expect(andClause.$and).toHaveLength(2)
  })
})
