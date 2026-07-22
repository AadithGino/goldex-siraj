import { createHash } from 'node:crypto'
import { AppError } from './AppError.js'

export const CUSTOMIZATION_MAX_LENGTH = 1000

/** Allow printable text plus common whitespace; reject other C0 controls. */
// eslint-disable-next-line no-control-regex -- intentional C0 control rejection
const DANGEROUS_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/

/**
 * Normalize a customization value for persistence.
 * @param {unknown} value
 * @param {{ present?: boolean }} [opts]
 * @returns {string|null|undefined} undefined when field was not present
 */
export function normalizeCustomization(value, { present = true } = {}) {
  if (!present) return undefined
  if (value === null) return null
  if (value === undefined) return null
  if (typeof value !== 'string') {
    throw new AppError(422, 'INVALID_CUSTOMIZATION', 'customization_request must be a string or null')
  }
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > CUSTOMIZATION_MAX_LENGTH) {
    throw new AppError(422, 'CUSTOMIZATION_TOO_LONG', `customization_request must be at most ${CUSTOMIZATION_MAX_LENGTH} characters`)
  }
  if (DANGEROUS_CONTROL.test(trimmed)) {
    throw new AppError(422, 'INVALID_CUSTOMIZATION', 'customization_request contains unsupported control characters')
  }
  return trimmed
}

/** Stable identity for cart-line uniqueness: empty string = no customization. */
export function customizationKey(normalized) {
  if (normalized == null || normalized === '') return ''
  return createHash('sha256').update(normalized).digest('hex')
}

/**
 * Resolve snake/camel aliases from a request body object.
 * Rejects conflicting dual values.
 * @returns {{ present: boolean, value: unknown }}
 */
export function resolveCustomizationAliases(body = {}) {
  const hasSnake = Object.prototype.hasOwnProperty.call(body, 'customization_request')
  const hasCamel = Object.prototype.hasOwnProperty.call(body, 'customizationRequest')
  if (hasSnake && hasCamel) {
    const snake = body.customization_request
    const camel = body.customizationRequest
    const same = snake === camel
      || (snake == null && camel == null)
      || (typeof snake === 'string' && typeof camel === 'string' && snake.trim() === camel.trim())
    if (!same) {
      throw new AppError(422, 'CUSTOMIZATION_CONFLICT', 'customization_request and customizationRequest must match when both are sent')
    }
    return { present: true, value: snake }
  }
  if (hasSnake) return { present: true, value: body.customization_request }
  if (hasCamel) return { present: true, value: body.customizationRequest }
  return { present: false, value: undefined }
}
