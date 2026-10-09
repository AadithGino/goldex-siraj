import { config } from '../config/env.js'

function normalizeOrigin(url) {
  return String(url || '').trim().replace(/\/+$/, '')
}

function isLocalOrigin(url) {
  return /localhost|127\.0\.0\.1/i.test(String(url || ''))
}

/**
 * Public storefront origin for Tabby merchant_urls and product_url (never localhost in production).
 * Production canonical site: https://www.goldexjewellery.ae
 * Prefer STOREFRONT_URL, then first non-local CLIENT_ORIGIN, then API_PUBLIC_URL origin.
 */
export function resolveStorefrontOrigin() {
  const explicit = normalizeOrigin(process.env.STOREFRONT_URL)
  if (explicit && !isLocalOrigin(explicit)) return explicit

  const fromClient = config.clientOrigins.map(normalizeOrigin).find((o) => o && !isLocalOrigin(o))
  if (fromClient) return fromClient

  const api = normalizeOrigin(config.publicApiUrl).replace(/\/api\/v1$/i, '')
  if (api && !isLocalOrigin(api)) return api

  return normalizeOrigin(config.clientOrigins[0]) || 'http://localhost:5173'
}
