export class SchemePayloadError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SchemePayloadError'
  }
}

function parsePositiveMoney(value, label) {
  if (value === '' || value == null) throw new SchemePayloadError(`${label} is required`)
  const n = Number(value)
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    throw new SchemePayloadError(`${label} must be a valid number`)
  }
  if (!(n > 0) || n > 1_000_000) {
    throw new SchemePayloadError(`${label} must be between 0.01 and 1000000`)
  }
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function parseWholeMonths(value, label, { min, max, required = true }) {
  if (value === '' || value == null) {
    if (!required) return null
    throw new SchemePayloadError(`${label} is required`)
  }
  const n = Number(value)
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    throw new SchemePayloadError(`${label} must be a valid number`)
  }
  if (!Number.isInteger(n)) {
    throw new SchemePayloadError(`${label} must be a whole number`)
  }
  if (n < min || n > max) {
    throw new SchemePayloadError(`${label} must be between ${min} and ${max}`)
  }
  return n
}

const SCHEME_TENURE_OPTIONS = [6, 12]

function parseTenureMonths(value, label) {
  const n = parseWholeMonths(value, label, { min: 6, max: 12 })
  if (!SCHEME_TENURE_OPTIONS.includes(n)) {
    throw new SchemePayloadError(`${label} must be 6 or 12 months`)
  }
  return n
}

/**
 * SchemeFormDialog → API payload (canonical snake_case).
 * Throws SchemePayloadError — never silently coerces invalid input.
 */
export function toSchemePayload(input = {}) {
  const name = String(input.name ?? '').trim()
  if (!name) throw new SchemePayloadError('Plan name is required')

  const benefitType = input.benefit_type === 'fixed_amount' ? 'fixed_amount' : 'bonus_months'
  const payload = {
    name,
    name_ar: input.name_ar ? String(input.name_ar).trim() : null,
    description: input.description ? String(input.description).trim() : null,
    description_ar: input.description_ar ? String(input.description_ar).trim() : null,
    monthly_amount: parsePositiveMoney(input.monthly_amount, 'Monthly amount'),
    tenure_months: parseTenureMonths(input.tenure_months, 'Tenure months'),
    bonus_months: parseWholeMonths(input.bonus_months, 'Bonus months', { min: 0, max: 24 }),
    benefit_type: benefitType,
    benefit_fixed_amount: benefitType === 'fixed_amount'
      ? parsePositiveMoney(input.benefit_fixed_amount, 'Fixed benefit amount')
      : 0,
    is_active: input.is_active === true,
  }

  if (Object.prototype.hasOwnProperty.call(input, 'terms')) {
    payload.terms = input.terms ? String(input.terms).trim() : null
  }
  if (Object.prototype.hasOwnProperty.call(input, 'terms_ar')) {
    payload.terms_ar = input.terms_ar ? String(input.terms_ar).trim() : null
  }

  return payload
}

/**
 * Record-payment dialog → API payload.
 */
export function toInstallmentPayPayload({
  amount,
  payment_method: paymentMethod,
  transaction_ref: transactionRef,
  note,
} = {}) {
  const method = String(paymentMethod || '').trim().toLowerCase()
  if (!['cash', 'bank_transfer', 'card'].includes(method)) {
    throw new SchemePayloadError('Select cash, bank transfer, or card')
  }
  const money = parsePositiveMoney(amount, 'Amount')
  let ref = null
  if (transactionRef != null && String(transactionRef).trim() !== '') {
    ref = String(transactionRef).trim().slice(0, 200)
  }
  if ((method === 'bank_transfer' || method === 'card') && !ref) {
    throw new SchemePayloadError('Transaction reference is required for bank transfer and card')
  }
  return {
    amount: money,
    payment_method: method,
    transaction_ref: ref,
    note: note != null && String(note).trim() ? String(note).trim().slice(0, 2000) : null,
  }
}

/** Customer enrollment payload */
export function toSchemeEnrollPayload({ scheme_id, passport_number, id_proof_key, id_proof_url } = {}) {
  if (!scheme_id) throw new SchemePayloadError('scheme_id is required')
  const passport = passport_number != null ? String(passport_number).trim() : ''
  const proof = id_proof_key || id_proof_url
  if (!passport && !proof) {
    throw new SchemePayloadError('Upload ID proof or enter passport number')
  }
  return {
    scheme_id,
    ...(passport ? { passport_number: passport } : {}),
    ...(id_proof_key ? { id_proof_key } : {}),
    ...(id_proof_url && !id_proof_key ? { id_proof_url } : {}),
  }
}

/** Admin enrollment payload */
export function toSchemeAdminEnrollPayload({
  customer_id,
  scheme_id,
  passport_number,
  id_proof_key,
  id_proof_url,
} = {}) {
  if (!customer_id) throw new SchemePayloadError('customer_id is required')
  return {
    customer_id,
    ...toSchemeEnrollPayload({ scheme_id, passport_number, id_proof_key, id_proof_url }),
  }
}

/** Completion body — note only; never sends client payout amount. */
export function toSchemeCompletePayload({ note } = {}) {
  const payload = {}
  if (note != null && String(note).trim()) {
    payload.note = String(note).trim().slice(0, 2000)
  }
  return payload
}
