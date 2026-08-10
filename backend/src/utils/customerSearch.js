export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Fuzzy customer filter: name/email substring, phone substring, and digit-ordered phone match.
 * e.g. "501 234" or "+971501234567" both match UAE numbers.
 */
export function buildCustomerSearchFilter(search) {
  const term = String(search || '').trim()
  if (!term) return null

  const or = []
  const escaped = escapeRegex(term)
  const textRe = new RegExp(escaped, 'i')
  or.push({ fullName: textRe }, { email: textRe }, { phone: textRe })

  const digits = term.replace(/\D/g, '')
  if (digits.length >= 3) {
    const digitPattern = digits.split('').map((d) => escapeRegex(d)).join('[^\\d]*')
    or.push({ phone: new RegExp(digitPattern) })
  }

  const tokens = term.split(/\s+/).filter((t) => t.length >= 2)
  if (tokens.length > 1) {
    or.push({
      $and: tokens.map((t) => ({ fullName: new RegExp(escapeRegex(t), 'i') })),
    })
  }

  return { $or: or }
}
