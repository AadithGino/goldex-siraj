import { BANNER_POSITIONS } from '@/lib/bannerSpecs'
import { dubaiYmdFromInstant, isYmd } from '@/lib/dubaiTime'

export class BannerPayloadError extends Error {
  constructor(message) {
    super(message)
    this.name = 'BannerPayloadError'
  }
}

function requireNonEmpty(value, label) {
  const s = value == null ? '' : String(value).trim()
  if (!s) throw new BannerPayloadError(`${label} is required`)
  return s
}

function optionalString(value) {
  if (value == null || value === '') return null
  return String(value).trim() || null
}

function parseDisplayOrder(value) {
  if (value === '' || value == null) return 0
  const n = Number(value)
  if (!Number.isFinite(n) || Number.isNaN(n) || !Number.isInteger(n) || n < 0) {
    throw new BannerPayloadError('display_order must be a non-negative integer')
  }
  return n
}

function parseYmdOrNull(value, label) {
  if (value == null || value === '') return null
  const s = String(value).trim()
  if (!isYmd(s)) throw new BannerPayloadError(`${label} must be YYYY-MM-DD`)
  return s
}

/**
 * BannerFormDialog → API payload (canonical snake_case).
 * Dates are Dubai calendar YYYY-MM-DD (server maps to Dubai day bounds).
 */
export function toBannerPayload(input = {}, { partial = false } = {}) {
  const position = input.position
  if (!partial || position != null) {
    if (!BANNER_POSITIONS.includes(position)) {
      throw new BannerPayloadError('position is required and must be a known banner slot')
    }
  }

  const payload = {}
  if (!partial || input.position != null) payload.position = position
  if (!partial || input.title != null) payload.title = requireNonEmpty(input.title, 'title')
  if ('title_ar' in input || !partial) payload.title_ar = optionalString(input.title_ar)
  if ('subtitle' in input || !partial) payload.subtitle = optionalString(input.subtitle)
  if ('subtitle_ar' in input || !partial) payload.subtitle_ar = optionalString(input.subtitle_ar)
  if ('eyebrow' in input || !partial) payload.eyebrow = optionalString(input.eyebrow)
  if ('eyebrow_ar' in input || !partial) payload.eyebrow_ar = optionalString(input.eyebrow_ar)

  if (!partial || input.image_url != null) {
    payload.image_url = requireNonEmpty(input.image_url, 'image_url')
  }
  if (!partial || input.mobile_image_url != null) {
    payload.mobile_image_url = requireNonEmpty(input.mobile_image_url, 'mobile_image_url')
  }
  if ('image_url_ar' in input || !partial) payload.image_url_ar = optionalString(input.image_url_ar)
  if ('mobile_image_url_ar' in input || !partial) {
    payload.mobile_image_url_ar = optionalString(input.mobile_image_url_ar)
  }
  if ('cta_text' in input || !partial) payload.cta_text = optionalString(input.cta_text)
  if ('cta_text_ar' in input || !partial) payload.cta_text_ar = optionalString(input.cta_text_ar)
  if ('cta_link' in input || !partial) payload.cta_link = optionalString(input.cta_link)

  if (!partial || input.display_order != null || input.display_order === 0) {
    payload.display_order = parseDisplayOrder(input.display_order)
  }
  if (!partial || typeof input.is_active === 'boolean') {
    payload.is_active = Boolean(input.is_active)
  }

  if ('starts_at' in input || !partial) {
    payload.starts_at = parseYmdOrNull(input.starts_at, 'starts_at')
  }
  if ('ends_at' in input || !partial) {
    payload.ends_at = parseYmdOrNull(input.ends_at, 'ends_at')
  }
  if (payload.starts_at && payload.ends_at && payload.starts_at > payload.ends_at) {
    throw new BannerPayloadError('starts_at must not be later than ends_at')
  }

  if (partial && !Object.keys(payload).length) {
    throw new BannerPayloadError('At least one field is required')
  }
  return payload
}

/** Round-trip API instant → Dubai YYYY-MM-DD for date inputs. */
export function bannerDateToInput(value) {
  return dubaiYmdFromInstant(value) || ''
}
