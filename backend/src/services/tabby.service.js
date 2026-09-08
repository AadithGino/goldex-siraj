import crypto from 'node:crypto'
import { config } from '../config/env.js'
import { AppError } from '../utils/AppError.js'

function normalizeBaseUrl(url) {
  return String(url || '').replace(/\/+$/, '')
}

function normalizeAmount(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100) / 100
}

export function getTabbyConfig() {
  const baseUrl = normalizeBaseUrl(config.tabby.baseUrl)
  const isConfigured = Boolean(
    config.tabby.enabled
    && baseUrl
    && config.tabby.secretKey
    && config.tabby.merchantCode,
  )
  return {
    ...config.tabby,
    baseUrl,
    isConfigured,
  }
}

export function resolveGoldexOrderIdFromTabbyReference(raw) {
  const value = String(raw || '').trim()
  if (!value) return null
  if (/^[a-f\d]{24}$/i.test(value)) return value.toLowerCase()
  const match = value.match(/^([a-f\d]{24})(?:[_-].+)?$/i)
  return match ? match[1].toLowerCase() : null
}

export function buildTabbyReference(orderId) {
  const id = String(orderId || '').trim()
  if (!/^[a-f\d]{24}$/i.test(id)) {
    throw new AppError(422, 'INVALID_ORDER_ID', 'Invalid order id for Tabby reference')
  }
  return `${id}_${Date.now()}`
}

function splitName(fullName = '') {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] || 'Customer',
    lastName: parts.slice(1).join(' ') || 'Goldex',
  }
}

function findCheckoutUrl(node) {
  if (!node || typeof node !== 'object') return null
  if (typeof node.web_url === 'string' && node.web_url.trim()) return node.web_url
  if (typeof node.checkout_url === 'string' && node.checkout_url.trim()) return node.checkout_url
  if (typeof node.url === 'string' && node.url.trim()) return node.url
  if (Array.isArray(node)) {
    for (const item of node) {
      const nested = findCheckoutUrl(item)
      if (nested) return nested
    }
    return null
  }
  for (const value of Object.values(node)) {
    const nested = findCheckoutUrl(value)
    if (nested) return nested
  }
  return null
}

function extractTabbyCheckoutUrl(data) {
  return (
    data?.web_url
    || data?.checkout_url
    || data?.configuration?.available_products?.installments?.[0]?.web_url
    || data?.configuration?.available_products?.installments?.[0]?.checkout_url
    || findCheckoutUrl(data)
    || null
  )
}

function extractTabbyRejectionReason(data) {
  return (
    data?.configuration?.products?.installments?.rejection_reason
    || data?.configuration?.products?.pay_later?.rejection_reason
    || data?.rejection_reason
    || data?.status_reason
    || null
  )
}

async function tabbyRequest(path, { method = 'GET', body } = {}) {
  const cfg = getTabbyConfig()
  if (!cfg.isConfigured) {
    throw new AppError(503, 'TABBY_NOT_CONFIGURED', 'Tabby is not configured')
  }

  const response = await fetch(`${cfg.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: body == null ? undefined : JSON.stringify(body),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = data?.error || data?.message || JSON.stringify(data)
    throw new AppError(502, 'TABBY_API_FAILED', `Tabby API failed: ${detail}`)
  }
  return data
}

export async function createTabbyCheckout({ order, customer, reference = null }) {
  const cfg = getTabbyConfig()
  if (!cfg.isConfigured) {
    throw new AppError(503, 'TABBY_NOT_CONFIGURED', 'Tabby is not configured')
  }

  const amount = normalizeAmount(order.amountDue ?? order.total ?? 0)
  if (amount < 1) {
    throw new AppError(422, 'TABBY_MIN_AMOUNT', 'Tabby requires at least AED 1.00')
  }

  const appOrigin = config.clientOrigins[0] || 'http://localhost:5173'
  const orderRef = reference || buildTabbyReference(order.id)
  const shipTo = order.shipTo || {}
  const { firstName, lastName } = splitName(shipTo.recipientName || customer?.fullName)

  const items = (order.items || []).map((item, index) => {
    const qty = Math.max(1, Number(item.qty) || 1)
    const lineTotal = normalizeAmount(item.lineTotal ?? item.unitPrice ?? 0)
    const unitPrice = normalizeAmount(lineTotal / qty)
    return {
      title: String(item.productName || `Item ${index + 1}`).slice(0, 120),
      quantity: qty,
      unit_price: unitPrice.toFixed(2),
      total_amount: normalizeAmount(unitPrice * qty).toFixed(2),
      category: 'jewellery',
    }
  })

  const payload = {
    merchant_code: cfg.merchantCode,
    lang: 'en',
    payment: {
      amount: amount.toFixed(2),
      currency: 'AED',
      description: `Order ${order.orderNumber || order.id}`,
      buyer: {
        email: String(customer?.email || 'customer@goldex.ae'),
        phone: String(shipTo.phone || customer?.phone || '+971500000000'),
        name: `${firstName} ${lastName}`.trim(),
      },
      order: {
        reference_id: orderRef,
        items: items.length ? items : [{
          title: `Order ${order.orderNumber || order.id}`,
          quantity: 1,
          unit_price: amount.toFixed(2),
          total_amount: amount.toFixed(2),
          category: 'jewellery',
        }],
      },
      shipping_address: {
        city: String(shipTo.city || 'Dubai'),
        address: String(shipTo.line1 || shipTo.line_1 || 'Dubai'),
        zip: String(shipTo.postalCode || shipTo.postal_code || '00000'),
        country: 'AE',
      },
    },
    merchant_urls: {
      success: `${appOrigin}/orders/${order.id}?payment=return&provider=tabby`,
      cancel: `${appOrigin}/orders/${order.id}?payment=cancelled&provider=tabby`,
      failure: `${appOrigin}/orders/${order.id}?payment=failed&provider=tabby`,
    },
  }

  const data = await tabbyRequest('/api/v2/checkout', { method: 'POST', body: payload })
  const checkoutUrl = extractTabbyCheckoutUrl(data)
  if (!checkoutUrl) {
    const status = String(data?.status || '').toLowerCase()
    const reason = extractTabbyRejectionReason(data)
    if (status === 'rejected') {
      throw new AppError(
        409,
        'TABBY_NOT_AVAILABLE',
        reason ? `Tabby is unavailable for this order: ${reason}` : 'Tabby is unavailable for this order',
      )
    }
    throw new AppError(
      502,
      'TABBY_CHECKOUT_FAILED',
      reason
        ? `Tabby did not return a checkout URL: ${reason}`
        : `Tabby did not return a checkout URL (status: ${status || 'unknown'})`,
    )
  }

  return {
    checkoutId: data?.id ? String(data.id) : null,
    paymentId: data?.payment?.id ? String(data.payment.id) : null,
    reference: orderRef,
    checkoutUrl,
    payload: data,
  }
}

export async function getTabbyPayment(paymentId) {
  if (!paymentId) return null
  try {
    return await tabbyRequest(`/api/v2/payments/${encodeURIComponent(String(paymentId))}`)
  } catch {
    return null
  }
}

export async function getTabbyCheckout(checkoutId) {
  if (!checkoutId) return null
  try {
    return await tabbyRequest(`/api/v2/checkout/${encodeURIComponent(String(checkoutId))}`)
  } catch {
    return null
  }
}

export function isTabbySuccessStatus(value) {
  const status = String(value || '').trim().toLowerCase()
  return ['authorized', 'captured', 'closed', 'paid'].includes(status)
}

export function isTabbyPendingStatus(value) {
  const status = String(value || '').trim().toLowerCase()
  return ['created', 'new', 'pending', 'processing'].includes(status)
}

export function extractTabbyOrderReference(payload = {}) {
  return payload?.payment?.order?.reference_id
    || payload?.order?.reference_id
    || payload?.reference_id
    || payload?.merchant_reference_id
    || null
}

export function extractTabbyPaymentData(payload = {}) {
  const payment = payload?.payment && typeof payload.payment === 'object' ? payload.payment : payload
  const amount = normalizeAmount(payment?.captured_amount ?? payment?.amount ?? payload?.amount)
  const currency = String(payment?.currency || payload?.currency || 'AED')
  return {
    id: payment?.id ? String(payment.id) : (payload?.id ? String(payload.id) : null),
    status: payment?.status || payload?.status || null,
    checkoutId: payload?.id ? String(payload.id) : null,
    orderReference: extractTabbyOrderReference(payload),
    amount,
    currency,
    raw: payload,
  }
}

function timingSafeEqualHex(a, b) {
  const left = String(a || '').trim().toLowerCase()
  const right = String(b || '').trim().toLowerCase()
  if (!left || !right || left.length !== right.length) return false
  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right))
}

export function verifyTabbyWebhookSignature(rawBody, signatureHeader) {
  const cfg = getTabbyConfig()
  if (!cfg.webhookSecret) return config.nodeEnv !== 'production'
  const signature = String(signatureHeader || '')
    .replace(/^sha256=/i, '')
    .trim()
    .toLowerCase()
  if (!signature) return false
  const digest = crypto
    .createHmac('sha256', cfg.webhookSecret)
    .update(String(rawBody || ''))
    .digest('hex')
  return timingSafeEqualHex(digest, signature)
}

