import {
  dubaiDateTimeLocalFromInstant,
  dubaiDateTimeLocalToIso,
  nowDubaiDateTimeLocal,
} from '@/lib/dubaiTime'

export const COUPON_DB_FIELDS = [
  'code',
  'discount_type',
  'discount_value',
  'min_order',
  'max_discount',
  'usage_limit',
  'per_customer_limit',
  'valid_from',
  'valid_to',
  'is_active',
]

export class CouponPayloadError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CouponPayloadError'
  }
}

/** @deprecated Use dubaiDateTimeLocalToIso — kept as alias for older imports/tests. */
export function datetimeLocalToIso(value) {
  return dubaiDateTimeLocalToIso(value)
}

function parseRequiredNumber(value, fieldLabel) {
  if (value === '' || value == null) {
    throw new CouponPayloadError(`${fieldLabel} is required`)
  }
  const n = Number(value)
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    throw new CouponPayloadError(`${fieldLabel} must be a valid number`)
  }
  return n
}

function parseOptionalPositiveNumber(value, fieldLabel) {
  if (value === '' || value == null) return null
  const n = Number(value)
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    throw new CouponPayloadError(`${fieldLabel} must be a valid number`)
  }
  if (!(n > 0)) {
    throw new CouponPayloadError(`${fieldLabel} must be greater than zero`)
  }
  return n
}

function parseOptionalPositiveInteger(value, fieldLabel) {
  if (value === '' || value == null) return null
  const n = Number(value)
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    throw new CouponPayloadError(`${fieldLabel} must be a valid number`)
  }
  if (!Number.isInteger(n)) {
    throw new CouponPayloadError(`${fieldLabel} must be a whole number`)
  }
  if (n < 1) {
    throw new CouponPayloadError(`${fieldLabel} must be at least 1`)
  }
  return n
}

function parseRequiredPositiveInteger(value, fieldLabel) {
  const n = parseOptionalPositiveInteger(value, fieldLabel)
  if (n == null) {
    throw new CouponPayloadError(`${fieldLabel} is required`)
  }
  return n
}

/**
 * CouponFormDialog → API payload (canonical snake_case contract).
 * Throws CouponPayloadError on invalid input — never returns NaN / silent truncations.
 */
export function toCouponPayload(input = {}) {
  const code = String(input.code ?? '').trim().toUpperCase()
  if (!code) throw new CouponPayloadError('Coupon code is required')

  const discountType = input.discount_type === 'flat' ? 'flat' : 'percent'
  const discountValue = parseRequiredNumber(input.discount_value, 'Discount value')
  if (!(discountValue > 0)) {
    throw new CouponPayloadError('Discount value must be greater than zero')
  }
  if (discountType === 'percent' && discountValue > 100) {
    throw new CouponPayloadError('Percent discount cannot exceed 100')
  }

  let minOrder = 0
  if (Object.prototype.hasOwnProperty.call(input, 'min_order') && input.min_order !== '') {
    minOrder = parseRequiredNumber(input.min_order, 'Minimum order')
    if (minOrder < 0) throw new CouponPayloadError('Minimum order must be zero or greater')
  }

  const maxDiscount = parseOptionalPositiveNumber(input.max_discount, 'Max discount')
  const usageLimit = parseOptionalPositiveInteger(input.usage_limit, 'Usage limit')
  const perCustomerLimit = parseRequiredPositiveInteger(
    input.per_customer_limit == null || input.per_customer_limit === ''
      ? 1
      : input.per_customer_limit,
    'Per customer limit',
  )

  const payload = {
    code,
    discount_type: discountType,
    discount_value: discountValue,
    min_order: minOrder,
    max_discount: maxDiscount,
    usage_limit: usageLimit,
    per_customer_limit: perCustomerLimit,
    is_active: input.is_active === true,
  }

  if (Object.prototype.hasOwnProperty.call(input, 'valid_from')) {
    try {
      payload.valid_from = dubaiDateTimeLocalToIso(input.valid_from)
    } catch {
      throw new CouponPayloadError('Valid from must be a valid date/time')
    }
  }
  if (Object.prototype.hasOwnProperty.call(input, 'valid_to')) {
    try {
      payload.valid_to = dubaiDateTimeLocalToIso(input.valid_to)
    } catch {
      throw new CouponPayloadError('Valid until must be a valid date/time')
    }
  }

  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => COUPON_DB_FIELDS.includes(key)),
  )
}

export function couponToFormState(coupon) {
  const DEFAULT = {
    code: '',
    discount_type: 'percent',
    discount_value: 10,
    min_order: 0,
    max_discount: '',
    usage_limit: '',
    per_customer_limit: 1,
    is_active: true,
    valid_from: nowDubaiDateTimeLocal(),
    valid_to: '',
  }
  if (!coupon?.id) return { ...DEFAULT }
  return {
    ...DEFAULT,
    code: coupon.code || '',
    discount_type: coupon.discount_type || 'percent',
    discount_value: coupon.discount_value ?? 10,
    min_order: coupon.min_order ?? 0,
    max_discount: coupon.max_discount ?? '',
    usage_limit: coupon.usage_limit ?? '',
    per_customer_limit: coupon.per_customer_limit ?? 1,
    is_active: coupon.is_active !== false,
    valid_from: dubaiDateTimeLocalFromInstant(coupon.valid_from) || DEFAULT.valid_from,
    valid_to: dubaiDateTimeLocalFromInstant(coupon.valid_to),
  }
}
