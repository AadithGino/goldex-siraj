import { AppError } from '../utils/AppError.js'
import { resolveAliasGroup } from '../validators/alias.js'

const BLOCKED = new Set([
  '_id', 'id', 'usedCount', 'used_count', 'createdAt', 'updatedAt',
  'created_at', 'updated_at', '__v',
])

/**
 * Parse offset-bearing ISO-8601 instants into Date.
 * Rejects timezone-less datetime strings (e.g. datetime-local without conversion).
 */
export function parseCouponInstant(value, fieldName) {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new AppError(422, 'INVALID_DATE', `${fieldName} is not a valid date`)
    }
    return value
  }
  if (typeof value !== 'string') {
    throw new AppError(422, 'INVALID_DATE', `${fieldName} must be an ISO-8601 string with timezone`)
  }
  const trimmed = value.trim()
  if (!trimmed) return null
  // Require Z or ±HH:MM offset — reject ambiguous local datetime-local strings.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(trimmed)) {
    throw new AppError(
      422,
      'AMBIGUOUS_DATETIME',
      `${fieldName} must be an ISO-8601 instant with timezone offset (e.g. 2026-07-21T14:00:00.000Z)`,
    )
  }
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) {
    throw new AppError(422, 'INVALID_DATE', `${fieldName} is not a valid date`)
  }
  return date
}

function pickDiscountType(body) {
  return resolveAliasGroup(body, ['discount_type', 'discountType', 'type'])
}

function pickDiscountValue(body) {
  return resolveAliasGroup(body, ['discount_value', 'discountValue', 'value'])
}

function pickMinOrder(body) {
  return resolveAliasGroup(body, ['min_order', 'minOrder', 'min_order_amount', 'minOrderAmount'])
}

function pickMaxDiscount(body) {
  return resolveAliasGroup(body, ['max_discount', 'maxDiscount'])
}

function pickUsageLimit(body) {
  return resolveAliasGroup(body, ['usage_limit', 'usageLimit'])
}

function pickPerCustomerLimit(body) {
  return resolveAliasGroup(body, ['per_customer_limit', 'perCustomerLimit'])
}

function pickValidFrom(body) {
  return resolveAliasGroup(body, ['valid_from', 'validFrom', 'starts_at', 'startsAt'])
}

function pickValidTo(body) {
  return resolveAliasGroup(body, ['valid_to', 'validTo', 'ends_at', 'endsAt'])
}

function pickIsActive(body) {
  return resolveAliasGroup(body, ['is_active', 'isActive'])
}

function pickCode(body) {
  return resolveAliasGroup(body, ['code'])
}

/**
 * Normalize a validated coupon body into Mongoose-safe camelCase fields.
 * Only known mutable fields are returned. Privileged counters are stripped.
 *
 * @param {object} body validated request body
 * @param {{ partial?: boolean }} [opts]
 */
export function toCouponWriteDto(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object') {
    throw new AppError(422, 'EMPTY_PAYLOAD', 'No allowed fields to write')
  }

  for (const key of Object.keys(body)) {
    if (BLOCKED.has(key)) {
      throw new AppError(422, 'FORBIDDEN_FIELD', `${key} cannot be set via this endpoint`)
    }
  }

  const dto = {}

  const code = pickCode(body)
  if (code.present) {
    const normalized = String(code.value ?? '').trim().toUpperCase()
    if (!normalized) throw new AppError(422, 'VALIDATION_ERROR', 'code is required')
    dto.code = normalized
  }

  const discountType = pickDiscountType(body)
  if (discountType.present) dto.discountType = discountType.value

  const discountValue = pickDiscountValue(body)
  if (discountValue.present) dto.discountValue = Number(discountValue.value)

  const minOrder = pickMinOrder(body)
  if (minOrder.present) dto.minOrder = Number(minOrder.value)

  const maxDiscount = pickMaxDiscount(body)
  if (maxDiscount.present) {
    dto.maxDiscount = maxDiscount.value == null || maxDiscount.value === ''
      ? null
      : Number(maxDiscount.value)
  }

  const usageLimit = pickUsageLimit(body)
  if (usageLimit.present) {
    dto.usageLimit = usageLimit.value == null || usageLimit.value === ''
      ? null
      : Number(usageLimit.value)
  }

  const perCustomer = pickPerCustomerLimit(body)
  if (perCustomer.present) dto.perCustomerLimit = Number(perCustomer.value)

  const validFrom = pickValidFrom(body)
  if (validFrom.present) {
    if (validFrom.value == null || validFrom.value === '') {
      // Create: omit so Mongoose default Date.now applies. PATCH: reject clearing.
      if (partial) {
        throw new AppError(422, 'VALIDATION_ERROR', 'valid_from cannot be cleared; omit the field or send an ISO instant')
      }
    } else {
      dto.validFrom = parseCouponInstant(validFrom.value, 'valid_from')
    }
  }

  const validTo = pickValidTo(body)
  if (validTo.present) {
    dto.validTo = parseCouponInstant(validTo.value, 'valid_to')
  }

  const isActive = pickIsActive(body)
  if (isActive.present) dto.isActive = Boolean(isActive.value)

  if (!partial) {
    if (!dto.code) throw new AppError(422, 'VALIDATION_ERROR', 'code is required')
    if (!dto.discountType) throw new AppError(422, 'VALIDATION_ERROR', 'discount_type is required')
    if (dto.discountValue == null) throw new AppError(422, 'VALIDATION_ERROR', 'discount_value is required')
  }

  if (!Object.keys(dto).length) {
    throw new AppError(422, 'EMPTY_PAYLOAD', 'No allowed fields to write')
  }

  assertCouponBusinessRules(dto, { partial })
  return dto
}

/**
 * Business rules that depend on discount type / numeric bounds.
 * For PATCH, pass mergedFinal when validating date range against existing record.
 */
export function assertCouponBusinessRules(dto, { partial = false, merged = null } = {}) {
  const type = merged?.discountType ?? dto.discountType
  const value = merged?.discountValue ?? dto.discountValue

  if (type != null && !['percent', 'flat'].includes(type)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'discount_type must be percent or flat')
  }

  if (value != null) {
    if (!(Number(value) > 0) || !Number.isFinite(Number(value))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'discount_value must be greater than 0')
    }
    if (type === 'percent' && Number(value) > 100) {
      throw new AppError(422, 'VALIDATION_ERROR', 'percent discount_value cannot exceed 100')
    }
  }

  if (dto.minOrder != null && (!(Number(dto.minOrder) >= 0) || !Number.isFinite(Number(dto.minOrder)))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'min_order must be >= 0')
  }

  if (Object.prototype.hasOwnProperty.call(dto, 'maxDiscount') && dto.maxDiscount != null) {
    if (!(Number(dto.maxDiscount) > 0) || !Number.isFinite(Number(dto.maxDiscount))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'max_discount must be greater than 0 when set')
    }
  }

  if (Object.prototype.hasOwnProperty.call(dto, 'usageLimit') && dto.usageLimit != null) {
    if (!Number.isInteger(Number(dto.usageLimit)) || Number(dto.usageLimit) < 1) {
      throw new AppError(422, 'VALIDATION_ERROR', 'usage_limit must be a positive integer or null')
    }
  }

  // usage_limit: 0 is forbidden (would look like unlimited accidentally) — null only
  if (dto.usageLimit === 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'usage_limit must be null for unlimited, not 0')
  }

  if (dto.perCustomerLimit != null) {
    if (!Number.isInteger(Number(dto.perCustomerLimit)) || Number(dto.perCustomerLimit) < 1) {
      throw new AppError(422, 'VALIDATION_ERROR', 'per_customer_limit must be a positive integer')
    }
  }

  const from = merged?.validFrom !== undefined ? merged.validFrom : dto.validFrom
  const to = merged?.validTo !== undefined ? merged.validTo : dto.validTo
  if (from != null && to != null && to.getTime() <= from.getTime()) {
    throw new AppError(422, 'INVALID_DATE_RANGE', 'valid_to must be later than valid_from')
  }

  if (!partial && from === undefined) {
    // Create without valid_from: Mongoose default Date.now applies — leave unset.
  }

  return dto
}

/**
 * Merge PATCH dto onto existing coupon for final-state validation.
 */
export function mergeCouponState(existing, dto) {
  return {
    discountType: dto.discountType ?? existing.discountType,
    discountValue: dto.discountValue ?? existing.discountValue,
    minOrder: dto.minOrder ?? existing.minOrder,
    maxDiscount: Object.prototype.hasOwnProperty.call(dto, 'maxDiscount')
      ? dto.maxDiscount
      : existing.maxDiscount,
    usageLimit: Object.prototype.hasOwnProperty.call(dto, 'usageLimit')
      ? dto.usageLimit
      : existing.usageLimit,
    perCustomerLimit: dto.perCustomerLimit ?? existing.perCustomerLimit,
    validFrom: Object.prototype.hasOwnProperty.call(dto, 'validFrom')
      ? dto.validFrom
      : existing.validFrom,
    validTo: Object.prototype.hasOwnProperty.call(dto, 'validTo')
      ? dto.validTo
      : existing.validTo,
    isActive: dto.isActive ?? existing.isActive,
    code: dto.code ?? existing.code,
    usedCount: existing.usedCount,
  }
}
