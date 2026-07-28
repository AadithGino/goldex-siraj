import {
  clearTokens,
  loadTokens,
  resolvePortal,
  saveTokens,
} from '@/lib/sessionTokens'

const API_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '')

/** In-memory access tokens (cookies still preferred when same-site; storage survives refresh). */
const memory = {
  customer: loadTokens('customer').accessToken,
  staff: loadTokens('staff').accessToken,
}

export function setAccessToken(token, { refreshToken, portal = 'customer' } = {}) {
  memory[portal] = token || null
  saveTokens(portal, {
    accessToken: token || null,
    ...(refreshToken !== undefined ? { refreshToken: refreshToken || null } : {}),
  })
}

export function clearAccessToken(portal) {
  if (portal) {
    memory[portal] = null
    clearTokens(portal)
    return
  }
  memory.customer = null
  memory.staff = null
  clearTokens('customer')
  clearTokens('staff')
}

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

const buildUrl = (path, query) => {
  const url = new URL(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, window.location.origin)
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  })
  return url.toString()
}

async function parse(response, { withMeta = false } = {}) {
  if (response.status === 204) return null
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(payload?.error?.message || `Request failed (${response.status})`, response.status, payload?.error?.code, payload?.error?.details)
  if (withMeta) return { data: payload?.data, meta: payload?.meta || null }
  return payload?.data
}

function bearerFor(path) {
  const portal = resolvePortal(window.location.pathname, path)
  return memory[portal] || loadTokens(portal).accessToken || null
}

async function request(method, path, { body, query, headers, retry = true, withMeta = false } = {}) {
  const portal = resolvePortal(window.location.pathname, path)
  const accessToken = bearerFor(path)
  let payloadBody = body
  // Cross-origin SPAs must send refresh_token in JSON; cookies alone are unreliable.
  if (path.endsWith('/auth/refresh') || path.endsWith('/auth/logout')) {
    const storedRefresh = loadTokens(portal).refreshToken
    const base = payloadBody && typeof payloadBody === 'object' ? payloadBody : {}
    payloadBody = storedRefresh ? { ...base, refresh_token: base.refresh_token || storedRefresh } : base
  }
  const response = await fetch(buildUrl(path, query), {
    method,
    credentials: 'include',
    headers: {
      ...(payloadBody instanceof FormData ? {} : { 'content-type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: payloadBody == null ? undefined : payloadBody instanceof FormData ? payloadBody : JSON.stringify(payloadBody),
  })
  const refreshable = !path.endsWith('/auth/refresh') && !path.endsWith('/auth/login') && !path.endsWith('/auth/logout') && !path.includes('/auth/otp/')
  if (response.status === 401 && retry && refreshable) {
    const storedRefresh = loadTokens(portal).refreshToken
    const refreshPath = portal === 'staff' ? '/staff/auth/refresh' : '/customer/auth/refresh'
    const refresh = await fetch(buildUrl(refreshPath), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(storedRefresh ? { refresh_token: storedRefresh } : {}),
    })
    if (refresh.ok) {
      const payload = await refresh.json().catch(() => null)
      const next = payload?.data?.access_token
      const nextRefresh = payload?.data?.refresh_token
      if (next) setAccessToken(next, { refreshToken: nextRefresh, portal })
      return request(method, path, { body, query, headers, retry: false, withMeta })
    }
    clearAccessToken(portal)
  }
  return parse(response, { withMeta })
}

export const api = {
  get: (path, query) => request('GET', path, { query }),
  getWithMeta: (path, query) => request('GET', path, { query, withMeta: true }),
  post: (path, body) => request('POST', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  delete: (path, body) => request('DELETE', path, { body }),
  upload: (path, file) => { const form = new FormData(); form.append('file', file); return request('POST', path, { body: form }) },
}
