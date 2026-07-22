import { AppError } from '../utils/AppError.js'
import { assertMetalWeights } from './pricingCalculator.js'

const UAE_COUNTRIES = new Set([
  'united arab emirates',
  'uae',
  'ae',
])

const UAE_EMIRATES = new Set([
  'abu dhabi',
  'ajman',
  'dubai',
  'fujairah',
  'ras al khaimah',
  'sharjah',
  'umm al quwain',
])

/** Fields customers may set. Ownership and audit fields are never accepted from the body. */
const ADDRESS_ALLOWLIST = new Set([
  'label',
  'recipientName',
  'phone',
  'line1',
  'line2',
  'city',
  'state',
  'pincode',
  'country',
  'latitude',
  'longitude',
  'isDefault',
])

const REJECTED_BODY_KEYS = new Set([
  'customerId',
  'customer_id',
  'userId',
  'user_id',
  'ownerId',
  'owner_id',
  'role',
  'createdBy',
  'created_by',
  'updatedBy',
  'updated_by',
  '_id',
  'id',
])

function pickSnakeOrCamel(input, snake, camel) {
  if (input[camel] !== undefined) return input[camel]
  if (input[snake] !== undefined) return input[snake]
  return undefined
}

/**
 * Normalize UAE delivery phone to E.164 (+971…).
 * Accepts +9715xxxxxxxx, 05xxxxxxxx, or 9-digit mobile starting with 5.
 */
export function normalizeUaeDeliveryPhone(input) {
  const raw = String(input || '').trim()
  if (!raw) throw new AppError(422, 'INVALID_PHONE', 'Phone is required')
  const digits = raw.replace(/\D/g, '')
  let local = digits
  if (local.startsWith('971')) local = local.slice(3)
  if (local.startsWith('0')) local = local.slice(1)
  if (!/^5\d{8}$/.test(local)) {
    throw new AppError(
      422,
      'INVALID_PHONE',
      'Phone must be a 9-digit UAE mobile starting with 5 (example: 501234567)',
    )
  }
  return `+971${local}`
}

export function toAddressDto(input = {}) {
  const source = { ...input }
  for (const key of REJECTED_BODY_KEYS) delete source[key]

  const dto = {}
  const label = pickSnakeOrCamel(source, 'label', 'label')
  const recipientName = pickSnakeOrCamel(source, 'recipient_name', 'recipientName')
  const phone = pickSnakeOrCamel(source, 'phone', 'phone')
  const line1 = pickSnakeOrCamel(source, 'line1', 'line1')
  const line2 = pickSnakeOrCamel(source, 'line2', 'line2')
  const city = pickSnakeOrCamel(source, 'city', 'city')
  const state = pickSnakeOrCamel(source, 'state', 'state')
  const pincode = pickSnakeOrCamel(source, 'pincode', 'pincode')
  const country = pickSnakeOrCamel(source, 'country', 'country')
  const latitude = pickSnakeOrCamel(source, 'latitude', 'latitude')
  const longitude = pickSnakeOrCamel(source, 'longitude', 'longitude')
  const isDefault = pickSnakeOrCamel(source, 'is_default', 'isDefault')

  if (label !== undefined) dto.label = String(label).trim()
  if (recipientName !== undefined) dto.recipientName = String(recipientName).trim()
  if (phone !== undefined) dto.phone = phone
  if (line1 !== undefined) dto.line1 = String(line1).trim()
  if (line2 !== undefined) dto.line2 = line2 == null || line2 === '' ? '' : String(line2).trim()
  if (city !== undefined) dto.city = String(city).trim()
  if (state !== undefined) dto.state = String(state).trim()
  if (pincode !== undefined) dto.pincode = pincode == null || pincode === '' ? '' : String(pincode).trim()
  if (country !== undefined) dto.country = String(country).trim()
  if (latitude !== undefined && latitude !== null && latitude !== '') {
    const n = Number(latitude)
    if (!Number.isFinite(n)) throw new AppError(422, 'INVALID_LATITUDE', 'Latitude must be a finite number')
    dto.latitude = n
  }
  if (longitude !== undefined && longitude !== null && longitude !== '') {
    const n = Number(longitude)
    if (!Number.isFinite(n)) throw new AppError(422, 'INVALID_LONGITUDE', 'Longitude must be a finite number')
    dto.longitude = n
  }
  if (isDefault !== undefined) dto.isDefault = Boolean(isDefault)

  for (const key of Object.keys(dto)) {
    if (!ADDRESS_ALLOWLIST.has(key)) delete dto[key]
  }
  return dto
}

export function assertAddressPayload(dto, { partial = false } = {}) {
  const required = ['label', 'recipientName', 'phone', 'line1', 'city', 'state', 'country']
  if (!partial) {
    for (const key of required) {
      if (dto[key] == null || String(dto[key]).trim() === '') {
        throw new AppError(422, 'ADDRESS_VALIDATION', `${key} is required`)
      }
    }
  }

  if (dto.label != null) {
    const normalized = String(dto.label).trim().toLowerCase()
    if (['home', 'work', 'other'].includes(normalized)) dto.label = normalized
    else if (String(dto.label).trim().length > 40) {
      throw new AppError(422, 'ADDRESS_VALIDATION', 'Label is too long')
    }
  }

  if (dto.phone != null) dto.phone = normalizeUaeDeliveryPhone(dto.phone)

  if (dto.recipientName != null && String(dto.recipientName).trim().length < 2) {
    throw new AppError(422, 'ADDRESS_VALIDATION', 'Recipient name is required')
  }
  if (dto.line1 != null && String(dto.line1).trim().length < 3) {
    throw new AppError(422, 'ADDRESS_VALIDATION', 'Building/street (line1) is required')
  }
  if (dto.city != null && !String(dto.city).trim()) {
    throw new AppError(422, 'ADDRESS_VALIDATION', 'City is required')
  }
  if (dto.state != null) {
    const emirate = String(dto.state).trim()
    if (!UAE_EMIRATES.has(emirate.toLowerCase())) {
      throw new AppError(422, 'ADDRESS_VALIDATION', 'State must be a UAE emirate')
    }
    dto.state = emirate
  }
  if (dto.country != null) {
    const country = String(dto.country).trim()
    if (!UAE_COUNTRIES.has(country.toLowerCase())) {
      throw new AppError(422, 'ADDRESS_VALIDATION', 'Country must be United Arab Emirates')
    }
    dto.country = 'United Arab Emirates'
  }

  return dto
}

export function assertVariantWeights(payload) {
  if (payload.weightGrams == null) return
  assertMetalWeights({
    weightGrams: payload.weightGrams,
    effectiveWeight: payload.effectiveWeight,
  })
}
