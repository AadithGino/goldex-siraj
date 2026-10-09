import crypto from 'node:crypto'
import { config } from '../config/env.js'
import { resolveStorefrontOrigin } from '../utils/storefrontOrigin.js'
import { logger } from '../config/logger.js'
import { Product } from '../models/catalog.models.js'
import { Order, WishlistItem } from '../models/commerce.models.js'
import { AppError } from '../utils/AppError.js'

const TABBY_CURRENCY = 'AED'
const TABBY_REQUEST_TIMEOUT_MS = 15_000
const ORDER_HISTORY_LIMIT = 10
// UAE has no postal codes, but Tabby requires `shipping_address.zip`.
const UAE_NO_POSTCODE = '00000'

function normalizeBaseUrl(url) {
  return String(url || '').replace(/\/+$/, '')
}

function normalizeAmount(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100) / 100
}

function money(value) {
  return normalizeAmount(value).toFixed(2)
}

function isoDate(value) {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function nonEmpty(value) {
  const text = String(value ?? '').trim()
  return text || undefined
}

function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined))
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

export function normalizeTabbyLang(value) {
  return String(value || '').toLowerCase().startsWith('ar') ? 'ar' : 'en'
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

export function tabbyCaptureReferenceId(orderId) {
  return `capture-${orderId}`
}

async function tabbyRequest(path, { method = 'GET', body } = {}) {
  const cfg = getTabbyConfig()
  if (!cfg.isConfigured) {
    throw new AppError(503, 'TABBY_NOT_CONFIGURED', 'Tabby is not configured')
  }

  let response
  try {
    response = await fetch(`${cfg.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.secretKey}`,
        'Content-Type': 'application/json',
        ...(cfg.merchantCode ? { 'X-Merchant-Code': cfg.merchantCode } : {}),
      },
      body: body == null ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TABBY_REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    throw new AppError(
      timedOut ? 504 : 502,
      timedOut ? 'TABBY_TIMEOUT' : 'TABBY_UNREACHABLE',
      timedOut ? 'Tabby API timed out' : `Tabby API unreachable: ${error?.message || 'network error'}`,
      { path, method },
    )
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = data?.error || data?.message || JSON.stringify(data)
    throw new AppError(502, 'TABBY_API_FAILED', `Tabby API failed: ${detail}`, {
      path,
      method,
      http_status: response.status,
      response: data,
    })
  }
  return data
}

function extractTabbyCheckoutUrl(data) {
  return data?.configuration?.available_products?.installments?.[0]?.web_url || null
}

export function extractTabbyRejectionReason(data) {
  return data?.configuration?.products?.installments?.rejection_reason || null
}

export function tabbyRejectedError(reason) {
  return new AppError(
    409,
    'TABBY_REJECTED',
    'Sorry, Tabby is unable to approve this purchase. Please use an alternative payment method for your order.',
    { rejection_reason: reason || 'not_available' },
  )
}

function assertTabbyBuyer({ phone, name }) {
  if (!phone) {
    throw new AppError(422, 'TABBY_PHONE_REQUIRED', 'A mobile number is required to pay with Tabby')
  }
  if (!name) {
    throw new AppError(422, 'TABBY_NAME_REQUIRED', 'A full name is required to pay with Tabby')
  }
}

export function buildTabbyBuyer({ customer, address }) {
  return {
    name: nonEmpty(address?.recipientName) || nonEmpty(customer?.fullName),
    email: nonEmpty(customer?.email),
    phone: nonEmpty(address?.phone) || nonEmpty(customer?.phone),
  }
}

function buildShippingAddress(address) {
  if (!address) return undefined
  const street = [address.line1, address.line2].map(nonEmpty).filter(Boolean).join(', ')
  const city = nonEmpty(address.city) || nonEmpty(address.state)
  if (!street || !city) return undefined
  return {
    city,
    address: street,
    zip: nonEmpty(address.pincode) || UAE_NO_POSTCODE,
  }
}

const ORDER_HISTORY_STATUS = {
  placed: 'new',
  confirmed: 'processing',
  processing: 'processing',
  shipped: 'processing',
  delivered: 'complete',
  cancelled: 'canceled',
  returned: 'refunded',
  partially_returned: 'complete',
}

const ORDER_HISTORY_PAYMENT_METHOD = {
  cod: 'cod',
  online: 'card',
}

function historyItem(item) {
  return compact({
    reference_id: nonEmpty(item.sku),
    title: String(item.productName || 'Item').slice(0, 120),
    quantity: Math.max(1, Number(item.qty) || 1),
    unit_price: money(Number(item.lineTotal || 0) / Math.max(1, Number(item.qty) || 1)),
  })
}

function buildOrderHistoryEntry(order, customer) {
  const address = order.shipTo || {}
  const buyer = buildTabbyBuyer({ customer, address })
  return compact({
    purchased_at: isoDate(order.placedAt || order.createdAt),
    amount: money(order.finalTotal ?? order.total),
    payment_method: ORDER_HISTORY_PAYMENT_METHOD[order.paymentMethod],
    status: ORDER_HISTORY_STATUS[order.status] || 'unknown',
    buyer: compact(buyer),
    shipping_address: buildShippingAddress(address),
    items: (order.items || []).map(historyItem),
  })
}

/**
 * Real customer data for Tabby scoring: registration date, verified flags, wishlist,
 * and the customer's previous orders. Optional fields are omitted when unknown.
 */
export async function loadTabbyCustomerContext(customer, { excludeOrderId = null, session = null } = {}) {
  if (!customer) return { buyerHistory: undefined, orderHistory: [] }
  const filter = { customerId: customer._id || customer.id }
  if (excludeOrderId) filter._id = { $ne: excludeOrderId }

  const [pastOrders, deliveredCount, wishlistCount] = await Promise.all([
    Order.find(filter).sort({ placedAt: -1 }).limit(ORDER_HISTORY_LIMIT).session(session).lean(),
    Order.countDocuments({ ...filter, status: 'delivered' }).session(session),
    WishlistItem.countDocuments({ customerId: filter.customerId }).session(session),
  ])

  const socialLogin = ['google', 'apple'].includes(customer.authProvider)
  const buyerHistory = compact({
    registered_since: isoDate(customer.createdAt),
    loyalty_level: deliveredCount,
    wishlist_count: wishlistCount,
    is_social_networks_connected: socialLogin,
    is_phone_number_verified: customer.authProvider === 'otp' && Boolean(customer.phone) ? true : undefined,
    is_email_verified: socialLogin && Boolean(customer.email) ? true : undefined,
  })

  return {
    buyerHistory,
    orderHistory: pastOrders.map((order) => buildOrderHistoryEntry(order, customer)),
  }
}

async function loadItemCatalogMeta(items, session) {
  const productIds = [...new Set((items || []).map((item) => item.productId).filter(Boolean).map(String))]
  if (!productIds.length) return new Map()
  const products = await Product.find({ _id: { $in: productIds } })
    .populate('categoryId', 'name')
    .populate('brandId', 'name')
    .session(session)
    .lean()
  return new Map(products.map((product) => [String(product._id), product]))
}

function buildSessionItems(order, catalogMeta) {
  const appOrigin = resolveStorefrontOrigin()
  return (order.items || []).map((item) => {
    const qty = Math.max(1, Number(item.qty) || 1)
    const product = catalogMeta.get(String(item.productId)) || {}
    const slug = nonEmpty(item.productSlug) || nonEmpty(product.slug)
    return compact({
      reference_id: nonEmpty(item.sku),
      title: String(item.productName || 'Jewellery').slice(0, 120),
      description: nonEmpty(item.variantLabel),
      quantity: qty,
      unit_price: money(Number(item.lineTotal ?? item.unitPrice ?? 0) / qty),
      discount_amount: '0.00',
      image_url: nonEmpty(item.imageUrl),
      product_url: slug && appOrigin ? `${appOrigin}/product/${slug}` : undefined,
      category: nonEmpty(product.categoryId?.name) || 'Jewellery',
      brand: nonEmpty(product.brandId?.name),
      color: nonEmpty(item.metalColor),
      product_material: nonEmpty(item.metalType),
      is_refundable: true,
    })
  })
}

export function buildTabbyMerchantUrls(orderId, { returnTo = 'checkout' } = {}) {
  const appOrigin = resolveStorefrontOrigin()
  const success = `${appOrigin}/orders/${orderId}?payment=return&provider=tabby`
  if (returnTo === 'order') {
    return {
      success,
      cancel: `${appOrigin}/orders/${orderId}?payment=cancelled&provider=tabby`,
      failure: `${appOrigin}/orders/${orderId}?payment=failed&provider=tabby`,
    }
  }
  return {
    success,
    cancel: `${appOrigin}/checkout?tabby=cancelled&order=${orderId}`,
    failure: `${appOrigin}/checkout?tabby=failed&order=${orderId}`,
  }
}

/** Full-payload session creation — only called from the "Place order" / "Pay with Tabby" action. */
export async function createTabbyCheckout({ order, customer, reference = null, lang = 'en', returnTo = 'checkout', session = null }) {
  const cfg = getTabbyConfig()
  if (!cfg.isConfigured) {
    throw new AppError(503, 'TABBY_NOT_CONFIGURED', 'Tabby is not configured')
  }

  const amount = normalizeAmount(order.amountDue ?? order.total ?? 0)
  if (amount <= 0) {
    throw new AppError(422, 'TABBY_INVALID_AMOUNT', 'Nothing to pay with Tabby for this order')
  }

  const shipTo = order.shipTo || {}
  const buyer = buildTabbyBuyer({ customer, address: shipTo })
  assertTabbyBuyer(buyer)
  const shippingAddress = buildShippingAddress(shipTo)
  if (!shippingAddress) {
    throw new AppError(422, 'TABBY_ADDRESS_REQUIRED', 'A complete delivery address is required to pay with Tabby')
  }

  const [context, catalogMeta] = await Promise.all([
    loadTabbyCustomerContext(customer, { excludeOrderId: order._id || order.id, session }),
    loadItemCatalogMeta(order.items, session),
  ])
  const orderRef = reference || buildTabbyReference(order.id)

  const payload = {
    merchant_code: cfg.merchantCode,
    lang: normalizeTabbyLang(lang),
    payment: compact({
      amount: money(amount),
      currency: TABBY_CURRENCY,
      description: `Order ${order.orderNumber || order.id}`,
      buyer: compact(buyer),
      shipping_address: shippingAddress,
      order: {
        reference_id: orderRef,
        updated_at: isoDate(order.updatedAt || new Date()),
        tax_amount: money(order.taxAmount),
        shipping_amount: money(order.shippingFee),
        discount_amount: money(Number(order.discountAmount || 0) + Number(order.walletApplied || 0)),
        items: buildSessionItems(order, catalogMeta),
      },
      buyer_history: context.buyerHistory,
      order_history: context.orderHistory,
      meta: {
        customer: String(customer?._id || customer?.id || order.customerId),
        order_id: String(order.orderNumber || order.id),
      },
    }),
    merchant_urls: buildTabbyMerchantUrls(order.id, { returnTo }),
  }

  const data = await tabbyRequest('/api/v2/checkout', { method: 'POST', body: payload })
  const status = String(data?.status || '').toLowerCase()
  const checkoutUrl = extractTabbyCheckoutUrl(data)
  if (status === 'rejected' || !checkoutUrl) {
    logger.info({
      orderId: String(order.id),
      status,
      rejectionReason: extractTabbyRejectionReason(data),
    }, 'Tabby session not available for order')
    throw tabbyRejectedError(extractTabbyRejectionReason(data))
  }

  return {
    checkoutId: data?.id ? String(data.id) : null,
    paymentId: data?.payment?.id ? String(data.payment.id) : null,
    reference: orderRef,
    checkoutUrl,
  }
}

/**
 * Background pre-scoring. Fail-safe: any API error or timeout reports Tabby as available
 * so checkout is never blocked; the real session creation re-checks eligibility.
 */
export async function runTabbyPrescoring({ amount, customer, address, lang = 'en' }) {
  const cfg = getTabbyConfig()
  if (!cfg.isConfigured) return { available: false, reason: 'not_configured' }

  const value = normalizeAmount(amount)
  if (value <= 0) return { available: true, reason: null }

  const buyer = buildTabbyBuyer({ customer, address })
  if (!buyer.phone) return { available: false, reason: 'phone_required' }

  try {
    const context = await loadTabbyCustomerContext(customer)
    const data = await tabbyRequest('/api/v2/checkout', {
      method: 'POST',
      body: {
        merchant_code: cfg.merchantCode,
        lang: normalizeTabbyLang(lang),
        payment: compact({
          amount: money(value),
          currency: TABBY_CURRENCY,
          buyer: compact(buyer),
          shipping_address: buildShippingAddress(address),
          buyer_history: context.buyerHistory,
          order_history: context.orderHistory,
        }),
      },
    })
    const status = String(data?.status || '').toLowerCase()
    if (status === 'rejected') {
      return { available: false, reason: extractTabbyRejectionReason(data) || 'not_available' }
    }
    return { available: true, reason: null }
  } catch (error) {
    logger.warn({ err: error }, 'Tabby pre-scoring failed; showing Tabby (fail-safe)')
    return { available: true, reason: null }
  }
}

export async function retrieveTabbyPayment(paymentId) {
  if (!paymentId) throw new AppError(422, 'TABBY_PAYMENT_ID_REQUIRED', 'Missing Tabby payment id')
  return tabbyRequest(`/api/v2/payments/${encodeURIComponent(String(paymentId))}`)
}

export async function getTabbyPayment(paymentId) {
  if (!paymentId) return null
  try {
    return await retrieveTabbyPayment(paymentId)
  } catch (error) {
    logger.warn({ err: error, paymentId }, 'Tabby retrieve payment failed')
    return null
  }
}

export async function captureTabbyPayment(paymentId, { amount, referenceId }) {
  return tabbyRequest(`/api/v2/payments/${encodeURIComponent(String(paymentId))}/captures`, {
    method: 'POST',
    body: { amount: money(amount), reference_id: String(referenceId) },
  })
}

export async function refundTabbyPayment(paymentId, { amount, referenceId, reason }) {
  return tabbyRequest(`/api/v2/payments/${encodeURIComponent(String(paymentId))}/refunds`, {
    method: 'POST',
    body: compact({
      amount: money(amount),
      reference_id: String(referenceId),
      reason: nonEmpty(reason)?.slice(0, 255),
    }),
  })
}

export async function closeTabbyPayment(paymentId) {
  return tabbyRequest(`/api/v2/payments/${encodeURIComponent(String(paymentId))}/close`, {
    method: 'POST',
  })
}

export function normalizeTabbyStatus(value) {
  return String(value || '').trim().toUpperCase()
}

export function tabbyEntriesByDate(entries) {
  return [...(Array.isArray(entries) ? entries : [])]
    .sort((a, b) => new Date(a?.created_at || 0) - new Date(b?.created_at || 0))
}

export function sumTabbyEntries(entries) {
  return normalizeAmount(tabbyEntriesByDate(entries).reduce((sum, entry) => sum + Number(entry?.amount || 0), 0))
}

export function extractTabbyPaymentData(payload = {}) {
  const payment = payload?.payment && typeof payload.payment === 'object' ? payload.payment : payload
  return {
    id: payment?.id ? String(payment.id) : null,
    status: normalizeTabbyStatus(payment?.status),
    orderReference: payment?.order?.reference_id || null,
    amount: normalizeAmount(payment?.amount),
    currency: String(payment?.currency || TABBY_CURRENCY).toUpperCase(),
    captures: tabbyEntriesByDate(payment?.captures),
    refunds: tabbyEntriesByDate(payment?.refunds),
    capturedAmount: sumTabbyEntries(payment?.captures),
    refundedAmount: sumTabbyEntries(payment?.refunds),
    raw: payload,
  }
}

function timingSafeEqualText(a, b) {
  const left = Buffer.from(String(a || ''))
  const right = Buffer.from(String(b || ''))
  if (!left.length || left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

/** Tabby echoes the static header (title/value) chosen when the webhook was registered. */
export function verifyTabbyWebhookAuth(headers = {}) {
  const cfg = getTabbyConfig()
  if (!cfg.webhookSecret) return config.nodeEnv !== 'production'
  const headerName = String(cfg.webhookHeaderName || '').trim().toLowerCase()
  if (!headerName) return false
  return timingSafeEqualText(headers[headerName], cfg.webhookSecret)
}
