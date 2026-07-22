/** Namespaced session cookies — customer and staff must never share cookie names. */
export const SESSION_COOKIES = {
  customerAccess: 'customerAccessToken',
  customerRefresh: 'customerRefreshToken',
  staffAccess: 'staffAccessToken',
  staffRefresh: 'staffRefreshToken',
  legacyAccess: 'accessToken',
  legacyRefresh: 'refreshToken',
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
  }
}

function clearLegacy(res, opts) {
  res.clearCookie(SESSION_COOKIES.legacyAccess, opts)
  res.clearCookie(SESSION_COOKIES.legacyRefresh, opts)
}

export function setCustomerSessionCookies(res, tokens) {
  const opts = cookieOptions()
  res.cookie(SESSION_COOKIES.customerAccess, tokens.accessToken, { ...opts, maxAge: tokens.accessExpiresIn * 1000 })
  res.cookie(SESSION_COOKIES.customerRefresh, tokens.refreshToken, { ...opts, maxAge: 30 * 86_400_000 })
  clearLegacy(res, opts)
}

export function setStaffSessionCookies(res, tokens) {
  const opts = cookieOptions()
  res.cookie(SESSION_COOKIES.staffAccess, tokens.accessToken, { ...opts, maxAge: tokens.accessExpiresIn * 1000 })
  res.cookie(SESSION_COOKIES.staffRefresh, tokens.refreshToken, { ...opts, maxAge: 30 * 86_400_000 })
  clearLegacy(res, opts)
}

export function clearCustomerSessionCookies(res) {
  const opts = cookieOptions()
  res.clearCookie(SESSION_COOKIES.customerAccess, opts)
  res.clearCookie(SESSION_COOKIES.customerRefresh, opts)
  clearLegacy(res, opts)
}

export function clearStaffSessionCookies(res) {
  const opts = cookieOptions()
  res.clearCookie(SESSION_COOKIES.staffAccess, opts)
  res.clearCookie(SESSION_COOKIES.staffRefresh, opts)
  clearLegacy(res, opts)
}

export function readCustomerAccessToken(req) {
  return req.cookies?.[SESSION_COOKIES.customerAccess]
    || req.get('authorization')?.replace(/^Bearer\s+/i, '')
    || null
}

export function readStaffAccessToken(req) {
  return req.cookies?.[SESSION_COOKIES.staffAccess]
    || req.get('authorization')?.replace(/^Bearer\s+/i, '')
    || null
}

/** Prefer namespaced refresh; fall back to legacy only for migration. */
export function readCustomerRefreshToken(req) {
  return req.cookies?.[SESSION_COOKIES.customerRefresh]
    || req.cookies?.[SESSION_COOKIES.legacyRefresh]
    || null
}

export function readStaffRefreshToken(req) {
  return req.cookies?.[SESSION_COOKIES.staffRefresh]
    || req.cookies?.[SESSION_COOKIES.legacyRefresh]
    || null
}

/**
 * Legacy accessToken may still exist briefly after deploy.
 * Only accept it when JWT actor type matches the expected portal.
 */
export function readLegacyAccessTokenIfType(req, expectedType, verify) {
  const legacy = req.cookies?.[SESSION_COOKIES.legacyAccess]
  if (!legacy) return null
  try {
    const payload = verify(legacy)
    return payload?.type === expectedType ? legacy : null
  } catch {
    return null
  }
}
