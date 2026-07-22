import { serialize } from './serialize.js'

export function maskTransactionRef(ref) {
  const value = String(ref || '').trim()
  if (!value) return null
  if (value.length <= 4) return '••••'
  return `••••${value.slice(-4)}`
}

function customerSafeReturn(row) {
  const data = serialize(row)
  if (!data || typeof data !== 'object') return data
  return {
    id: data.id,
    order_id: data.order_id,
    kind: data.kind,
    status: data.status,
    reason: data.reason,
    requested_at: data.requested_at,
    resolved_at: data.resolved_at,
    resolution_note: data.resolution_note,
  }
}

function customerSafePaymentCollection(collection) {
  if (!collection) return null
  const data = serialize(collection)
  return {
    amount: data.amount ?? null,
    currency: data.currency || 'AED',
    transaction_ref_masked: maskTransactionRef(data.transaction_ref),
  }
}

/** Customer-facing order DTO: strips staff IDs, notes, and unmasked payment refs. */
export function toCustomerOrderDto(order, { returns = [], displayImageByProductId = {} } = {}) {
  const data = serialize(order)
  if (!data || typeof data !== 'object') return data

  const items = (data.items || []).map((item) => ({
    ...item,
    image_url: item.image_url || displayImageByProductId[String(item.product_id)] || null,
  }))

  return {
    id: data.id,
    order_number: data.order_number,
    invoice_number: data.invoice_number ?? null,
    status: data.status,
    payment_method: data.payment_method,
    payment_mode: data.payment_mode,
    payment_status: data.payment_status,
    pricing_mode: data.pricing_mode,
    subtotal: data.subtotal,
    making_charge_total: data.making_charge_total,
    discount_amount: data.discount_amount,
    tax_amount: data.tax_amount,
    tax_breakdown: data.tax_breakdown || null,
    shipping_fee: data.shipping_fee,
    wallet_applied: data.wallet_applied,
    total: data.total,
    estimated_total: data.estimated_total,
    final_total: data.final_total,
    amount_due: data.amount_due,
    coupon_code: data.coupon_code ?? null,
    coupon_snapshot: data.coupon_snapshot
      ? {
          code: data.coupon_snapshot.code,
          discount_type: data.coupon_snapshot.discount_type,
          discount_value: data.coupon_snapshot.discount_value,
          max_discount: data.coupon_snapshot.max_discount,
          discount_amount_at_placement: data.coupon_snapshot.discount_amount_at_placement,
        }
      : null,
    ship_to: data.ship_to,
    is_gift: data.is_gift,
    gift_note: data.gift_note,
    items,
    gold_rate_snapshot: data.gold_rate_snapshot,
    placed_at: data.placed_at,
    finalized_at: data.finalized_at,
    paid_at: data.paid_at,
    delivered_at: data.delivered_at,
    payment_collection: customerSafePaymentCollection(data.payment_collection),
    status_history: (data.status_history || []).map((entry) => ({
      status: entry.status,
      note: entry.note,
      created_at: entry.created_at,
    })),
    returns: returns.map(customerSafeReturn),
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}
