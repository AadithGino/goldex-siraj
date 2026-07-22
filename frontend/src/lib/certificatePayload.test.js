import { describe, expect, it } from 'vitest'
import { CertificatePayloadError, toCertificatePayload } from './certificatePayload'

describe('toCertificatePayload', () => {
  const base = {
    product_id: '507f1f77bcf86cd799439011',
    variant_id: null,
    cert_number: 'GIA-998877',
    authority: 'GIA',
    issued_date: '2026-03-15',
    metadata: { carat: '1.02' },
    file_url: 'https://cdn.example.com/cert.pdf',
  }

  it('emits canonical snake_case FE contract', () => {
    expect(toCertificatePayload(base)).toEqual({
      product_id: '507f1f77bcf86cd799439011',
      variant_id: null,
      cert_number: 'GIA-998877',
      authority: 'GIA',
      issued_date: '2026-03-15',
      metadata: { carat: '1.02' },
      file_url: 'https://cdn.example.com/cert.pdf',
    })
  })

  it('requires product_id, cert_number, authority', () => {
    expect(() => toCertificatePayload({ ...base, product_id: '' })).toThrow(/product_id/)
    expect(() => toCertificatePayload({ ...base, cert_number: '  ' })).toThrow(/cert_number/)
    expect(() => toCertificatePayload({ ...base, authority: '' })).toThrow(/authority/)
  })

  it('validates issued_date as YYYY-MM-DD and metadata shape', () => {
    expect(() => toCertificatePayload({ ...base, issued_date: '15-03-2026' })).toThrow(/issued_date/)
    expect(toCertificatePayload({ ...base, issued_date: '' }).issued_date).toBeNull()
    expect(() => toCertificatePayload({ ...base, metadata: ['x'] })).toThrow(/metadata/)
    expect(() => toCertificatePayload({
      ...base,
      metadata: { '$gt': 1 },
    })).toThrow(/metadata key/)
  })

  it('partial update requires at least one field; file_url optional unless provided', () => {
    expect(() => toCertificatePayload({}, { partial: true })).toThrow(/At least one field/)
    expect(toCertificatePayload({ authority: 'IGI' }, { partial: true })).toEqual({ authority: 'IGI' })
    expect(toCertificatePayload({ file_url: null }, { partial: true })).toEqual({ file_url: null })
  })
})
