import { isYmd } from '@/lib/dubaiTime'

export class CertificatePayloadError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CertificatePayloadError'
  }
}

/**
 * ProductCertificatesPanel → API payload (canonical snake_case).
 * file_url is attached by the upload hook after trusted upload.
 */
export function toCertificatePayload(input = {}, { partial = false } = {}) {
  const payload = {}

  if (!partial || input.product_id != null || input.productId != null) {
    const productId = input.product_id ?? input.productId
    if (!productId) throw new CertificatePayloadError('product_id is required')
    payload.product_id = String(productId)
  }

  if ('variant_id' in input || 'variantId' in input || !partial) {
    const variantId = input.variant_id ?? input.variantId
    payload.variant_id = variantId ? String(variantId) : null
  }

  if (!partial || input.cert_number != null) {
    const cert = String(input.cert_number || '').trim()
    if (!cert) throw new CertificatePayloadError('cert_number is required')
    payload.cert_number = cert
  }

  if (!partial || input.authority != null) {
    const authority = String(input.authority || '').trim()
    if (!authority) throw new CertificatePayloadError('authority is required')
    payload.authority = authority
  }

  if ('issued_date' in input || !partial) {
    if (input.issued_date == null || input.issued_date === '') {
      payload.issued_date = null
    } else {
      const ymd = String(input.issued_date).trim()
      if (!isYmd(ymd)) throw new CertificatePayloadError('issued_date must be YYYY-MM-DD')
      payload.issued_date = ymd
    }
  }

  if ('metadata' in input || !partial) {
    const meta = input.metadata
    if (meta == null) payload.metadata = {}
    else if (typeof meta !== 'object' || Array.isArray(meta)) {
      throw new CertificatePayloadError('metadata must be a plain object')
    } else {
      for (const key of Object.keys(meta)) {
        if (key.startsWith('$') || key.includes('.') || key === '__proto__') {
          throw new CertificatePayloadError(`metadata key "${key}" is not allowed`)
        }
      }
      payload.metadata = meta
    }
  }

  if ('file_url' in input) {
    payload.file_url = input.file_url == null || input.file_url === ''
      ? null
      : String(input.file_url)
  }

  if (partial && !Object.keys(payload).length) {
    throw new CertificatePayloadError('At least one field is required')
  }
  return payload
}
