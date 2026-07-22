import { AppError } from '../utils/AppError.js'
import { resolveAliasGroup } from '../validators/alias.js'
import { roundMoney } from '../utils/money.js'

const BLOCKED = new Set([
  '_id', 'id', 'createdAt', 'updatedAt', 'created_at', 'updated_at', '__v',
  'enrollmentCount', 'enrollment_count', 'totalPaid', 'total_paid',
  'payoutAmount', 'payout_amount', 'monthlyAmountSnapshot', 'monthly_amount_snapshot',
  'tenureMonthsSnapshot', 'tenure_months_snapshot', 'bonusMonthsSnapshot', 'bonus_months_snapshot',
  'installments', 'statusHistory', 'status_history', 'completedBy', 'cancelledBy',
])

const MAX_MONTHLY = 1_000_000
const MAX_TENURE = 120
const MAX_BONUS = 24

function pickString(body, keys, { max = 2000, allowEmpty = true } = {}) {
  const resolved = resolveAliasGroup(body, keys)
  if (!resolved.present) return { present: false }
  if (resolved.value == null) return { present: true, value: null }
  const str = String(resolved.value).trim()
  if (!str) {
    if (!allowEmpty) throw new AppError(422, 'VALIDATION_ERROR', `${keys[0]} is required`)
    return { present: true, value: null }
  }
  if (str.length > max) throw new AppError(422, 'VALIDATION_ERROR', `${keys[0]} is too long`)
  return { present: true, value: str }
}

function pickPositiveMoney(body, keys, { required = false } = {}) {
  const resolved = resolveAliasGroup(body, keys)
  if (!resolved.present) {
    if (required) throw new AppError(422, 'VALIDATION_ERROR', `${keys[0]} is required`)
    return { present: false }
  }
  const raw = resolved.value
  if (raw === '' || raw == null) {
    throw new AppError(422, 'VALIDATION_ERROR', `${keys[0]} must be a valid number`)
  }
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    throw new AppError(422, 'VALIDATION_ERROR', `${keys[0]} must be a finite number`)
  }
  if (!(n > 0) || n > MAX_MONTHLY) {
    throw new AppError(422, 'VALIDATION_ERROR', `${keys[0]} must be between 0.01 and ${MAX_MONTHLY}`)
  }
  return { present: true, value: roundMoney(n) }
}

function pickWholeMonths(body, keys, { min, max, required = false } = {}) {
  const resolved = resolveAliasGroup(body, keys)
  if (!resolved.present) {
    if (required) throw new AppError(422, 'VALIDATION_ERROR', `${keys[0]} is required`)
    return { present: false }
  }
  const raw = resolved.value
  if (raw === '' || raw == null) {
    throw new AppError(422, 'VALIDATION_ERROR', `${keys[0]} must be a whole number`)
  }
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    throw new AppError(422, 'VALIDATION_ERROR', `${keys[0]} must be a finite number`)
  }
  if (!Number.isInteger(n)) {
    throw new AppError(422, 'VALIDATION_ERROR', `${keys[0]} must be a whole number`)
  }
  if (n < min || n > max) {
    throw new AppError(422, 'VALIDATION_ERROR', `${keys[0]} must be between ${min} and ${max}`)
  }
  return { present: true, value: n }
}

/**
 * Normalize validated scheme body into Mongoose-safe camelCase fields.
 */
export function toSchemeWriteDto(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object') {
    throw new AppError(422, 'EMPTY_PAYLOAD', 'No allowed fields to write')
  }
  for (const key of Object.keys(body)) {
    if (BLOCKED.has(key)) {
      throw new AppError(422, 'FORBIDDEN_FIELD', `${key} cannot be set via this endpoint`)
    }
  }

  const dto = {}

  const name = pickString(body, ['name'], { max: 200, allowEmpty: false })
  if (name.present) dto.name = name.value

  const nameAr = pickString(body, ['name_ar', 'nameAr'], { max: 200 })
  if (nameAr.present) dto.nameAr = nameAr.value

  const description = pickString(body, ['description'], { max: 5000 })
  if (description.present) dto.description = description.value

  const descriptionAr = pickString(body, ['description_ar', 'descriptionAr'], { max: 5000 })
  if (descriptionAr.present) dto.descriptionAr = descriptionAr.value

  const monthly = pickPositiveMoney(body, ['monthly_amount', 'monthlyAmount'], { required: !partial })
  if (monthly.present) dto.monthlyAmount = monthly.value

  const tenure = pickWholeMonths(body, ['tenure_months', 'tenureMonths'], {
    min: 1, max: MAX_TENURE, required: !partial,
  })
  if (tenure.present) dto.tenureMonths = tenure.value

  const bonus = pickWholeMonths(body, ['bonus_months', 'bonusMonths'], {
    min: 0, max: MAX_BONUS, required: false,
  })
  if (bonus.present) dto.bonusMonths = bonus.value

  const isActive = resolveAliasGroup(body, ['is_active', 'isActive'])
  if (isActive.present) dto.isActive = Boolean(isActive.value)

  const terms = pickString(body, ['terms'], { max: 10_000 })
  if (terms.present) dto.terms = terms.value

  const termsAr = pickString(body, ['terms_ar', 'termsAr'], { max: 10_000 })
  if (termsAr.present) dto.termsAr = termsAr.value

  if (!partial) {
    if (!dto.name) throw new AppError(422, 'VALIDATION_ERROR', 'name is required')
    if (dto.monthlyAmount == null) throw new AppError(422, 'VALIDATION_ERROR', 'monthly_amount is required')
    if (dto.tenureMonths == null) throw new AppError(422, 'VALIDATION_ERROR', 'tenure_months is required')
    if (dto.bonusMonths == null) dto.bonusMonths = 0
  }

  if (!Object.keys(dto).length) {
    throw new AppError(422, 'EMPTY_PAYLOAD', 'No allowed fields to write')
  }
  return dto
}

const ALLOWED_PAY_METHODS = new Set(['cash', 'bank_transfer', 'card'])

/**
 * Normalize a scheme payment transaction reference for uniqueness.
 * Rule: trim + uppercase (case-insensitive). Empty → null.
 * Display value should preserve the original trimmed (non-uppercased) form.
 */
export function normalizeSchemeTransactionRef(value) {
  if (value == null) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  return trimmed.toUpperCase()
}

export function displaySchemeTransactionRef(value) {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed || null
}

/**
 * Normalize installment payment body (after Zod).
 * @returns {{ amount: number, paymentMethod: string, transactionRef: string|null, note: string|null }}
 */
export function toInstallmentPayDto(body = {}) {
  for (const key of Object.keys(body || {})) {
    if (['amount', 'payment_method', 'paymentMethod', 'payment_mode', 'paymentMode',
      'transaction_ref', 'transactionRef', 'note'].includes(key)) continue
    throw new AppError(422, 'FORBIDDEN_FIELD', `${key} is not allowed`)
  }

  const amountRaw = body.amount
  if (amountRaw === '' || amountRaw == null) {
    throw new AppError(422, 'VALIDATION_ERROR', 'amount is required')
  }
  const amount = roundMoney(Number(amountRaw))
  if (!Number.isFinite(amount) || !(amount > 0)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'amount must be a positive finite number')
  }

  const methodGroup = resolveAliasGroup(body, ['payment_method', 'paymentMethod', 'payment_mode', 'paymentMode'])
  if (!methodGroup.present || methodGroup.value == null || methodGroup.value === '') {
    throw new AppError(422, 'VALIDATION_ERROR', 'payment_method is required')
  }
  const paymentMethod = String(methodGroup.value).trim().toLowerCase()
  if (!ALLOWED_PAY_METHODS.has(paymentMethod)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'payment_method must be cash, bank_transfer, or card')
  }

  const refGroup = resolveAliasGroup(body, ['transaction_ref', 'transactionRef'])
  let transactionRef = null
  if (refGroup.present && refGroup.value != null && String(refGroup.value).trim() !== '') {
    transactionRef = displaySchemeTransactionRef(String(refGroup.value).slice(0, 200))
  }
  if ((paymentMethod === 'bank_transfer' || paymentMethod === 'card') && !transactionRef) {
    throw new AppError(422, 'TRANSACTION_REF_REQUIRED', 'transaction_ref is required for bank_transfer and card')
  }
  if (paymentMethod === 'cash') {
    transactionRef = null
  }

  const note = body.note == null || body.note === ''
    ? null
    : String(body.note).trim().slice(0, 2000) || null

  return { amount, paymentMethod, transactionRef, note }
}

export function maskTransactionRef(ref) {
  if (ref == null || ref === '') return null
  const s = String(ref)
  if (s.length <= 4) return '****'
  return `${'*'.repeat(Math.min(8, s.length - 4))}${s.slice(-4)}`
}

export function computeSchemePayout(enrollment) {
  return roundMoney(
    Number(enrollment.monthlyAmountSnapshot)
    * (Number(enrollment.tenureMonthsSnapshot) + Number(enrollment.bonusMonthsSnapshot || 0)),
  )
}

export { MAX_MONTHLY, MAX_TENURE, MAX_BONUS, ALLOWED_PAY_METHODS }
