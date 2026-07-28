/** Persist auth tokens for S3/CloudFront SPAs where cross-site cookies are unreliable. */

const KEYS = {
  customer: { access: 'goldex.customer.access', refresh: 'goldex.customer.refresh' },
  staff: { access: 'goldex.staff.access', refresh: 'goldex.staff.refresh' },
}

export function resolvePortal(pathname = window.location.pathname, apiPath = '') {
  if (apiPath.startsWith('/staff/') || apiPath.startsWith('/admin/') || pathname.startsWith('/admin')) {
    return 'staff'
  }
  return 'customer'
}

function read(key) {
  try {
    const value = localStorage.getItem(key)
    return value || null
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    /* private mode / blocked storage */
  }
}

export function loadTokens(portal) {
  const keys = KEYS[portal]
  return {
    accessToken: read(keys.access),
    refreshToken: read(keys.refresh),
  }
}

export function saveTokens(portal, { accessToken, refreshToken } = {}) {
  const keys = KEYS[portal]
  if (accessToken !== undefined) write(keys.access, accessToken)
  if (refreshToken !== undefined) write(keys.refresh, refreshToken)
}

export function clearTokens(portal) {
  const keys = KEYS[portal]
  write(keys.access, null)
  write(keys.refresh, null)
}
