import { sanitizeCmsHtml } from '@/lib/htmlSanitize'

export class CmsPayloadError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CmsPayloadError'
  }
}

function normalizeSlug(slug) {
  return String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}

/**
 * CmsFormDialog → API payload (canonical snake_case).
 * Content is sanitized client-side for UX; server re-sanitizes before persist.
 */
export function toCmsPayload(input = {}, { partial = false } = {}) {
  const payload = {}

  if (!partial || input.slug != null) {
    const slug = normalizeSlug(input.slug)
    if (!slug) throw new CmsPayloadError('slug is required')
    payload.slug = slug
  }

  if (!partial || input.title != null) {
    const title = String(input.title || '').trim()
    if (!title) throw new CmsPayloadError('title is required')
    payload.title = title
  }

  if ('title_ar' in input || !partial) {
    payload.title_ar = input.title_ar == null || input.title_ar === ''
      ? null
      : String(input.title_ar).trim()
  }

  if (!partial || input.content != null) {
    if (input.content == null || String(input.content).trim() === '') {
      throw new CmsPayloadError('content is required')
    }
    payload.content = sanitizeCmsHtml(String(input.content))
  }

  if ('content_ar' in input || !partial) {
    payload.content_ar = input.content_ar == null || input.content_ar === ''
      ? null
      : sanitizeCmsHtml(String(input.content_ar))
  }

  if (!partial || typeof input.is_published === 'boolean') {
    payload.is_published = Boolean(input.is_published)
  }

  if (partial && !Object.keys(payload).length) {
    throw new CmsPayloadError('At least one field is required')
  }
  return payload
}
