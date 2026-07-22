const API_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '')

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

async function request(method, path, { body, query, headers, retry = true, withMeta = false } = {}) {
  const response = await fetch(buildUrl(path, query), {
    method,
    credentials: 'include',
    headers: { ...(body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...headers },
    body: body == null ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  })
  const refreshable = !path.endsWith('/auth/refresh') && !path.endsWith('/auth/login') && !path.endsWith('/auth/logout') && !path.includes('/auth/otp/')
  if (response.status === 401 && retry && refreshable) {
    const staffPortal = window.location.pathname.startsWith('/admin')
    const refresh = await fetch(buildUrl(staffPortal ? '/staff/auth/refresh' : '/customer/auth/refresh'), { method: 'POST', credentials: 'include' })
    if (refresh.ok) return request(method, path, { body, query, headers, retry: false, withMeta })
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
