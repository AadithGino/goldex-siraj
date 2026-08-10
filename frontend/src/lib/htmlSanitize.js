/**
 * Frontend CMS HTML sanitizer — same allowlist as backend.
 * Defensive at render time; server remains the trust boundary for persistence.
 */
import sanitizeHtml from 'sanitize-html'

export const CMS_SANITIZE_OPTIONS = {
  allowedTags: [
    'p', 'br', 'h1', 'h2', 'h3', 'h4',
    'ul', 'ol', 'li',
    'strong', 'em', 'b', 'i', 'u',
    'a', 'blockquote', 'hr',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href || ''
      const out = { ...attribs }
      if (out.target === '_blank') {
        out.rel = 'noopener noreferrer'
      }
      if (/^\s*javascript:/i.test(href) || /^\s*data:/i.test(href) || /^\s*vbscript:/i.test(href)) {
        delete out.href
      }
      return { tagName, attribs: out }
    },
  },
  disallowedTagsMode: 'discard',
}

export function sanitizeCmsHtml(input) {
  if (input == null) return ''
  if (typeof input !== 'string') return ''
  return sanitizeHtml(input, CMS_SANITIZE_OPTIONS)
}

/** Render CMS content that may be plain text (admin textarea) or allowed HTML. */
export function formatCmsContentForDisplay(input) {
  const sanitized = sanitizeCmsHtml(String(input || ''))
  if (!sanitized.trim()) return ''
  if (/<(?:p|h[1-4]|ul|ol|li|blockquote|br|strong|em|a)\b/i.test(sanitized)) {
    return sanitized
  }
  return sanitized
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('')
}
