export function maskTransactionRef(ref) {
  const value = String(ref || '').trim()
  if (!value) return null
  if (value.length <= 4) return '••••'
  return `••••${value.slice(-4)}`
}

export function adaptOrderItem(item = {}) {
  const breakup = item.breakup || {}
  return {
    ...item,
    id: item.id || item._id || null,
    product_id: item.product_id ?? item.productId ?? null,
    variant_id: item.variant_id ?? item.variantId ?? null,
    product_name: item.product_name ?? item.productName ?? 'Item',
    product_name_ar: item.product_name_ar ?? item.productNameAr ?? null,
    product_slug: item.product_slug ?? item.productSlug ?? null,
    sku: item.sku ?? null,
    image_url: item.image_url ?? item.imageUrl ?? null,
    variant_label: item.variant_label ?? item.variantLabel ?? null,
    variant_label_ar: item.variant_label_ar ?? item.variantLabelAr ?? null,
    qty: Number(item.qty || 0),
    purity: item.purity ?? breakup.purity ?? null,
    weight_grams: item.weight_grams ?? item.weightGrams ?? null,
    effective_weight: item.effective_weight ?? item.effectiveWeight ?? null,
    unit_price: item.unit_price ?? item.unitPrice ?? null,
    line_total: item.line_total ?? item.lineTotal ?? null,
    making_charge: item.making_charge ?? item.makingCharge ?? breakup.making_charge ?? null,
    stone_charge: item.stone_charge ?? item.stoneCharge ?? breakup.stone_charge ?? null,
    metal_type: item.metal_type ?? item.metalType ?? null,
    metal_color: item.metal_color ?? item.metalColor ?? null,
    customization_request: item.customization_request ?? item.customizationRequest ?? null,
    breakup,
  }
}

export function adaptStatusHistory(entry = {}) {
  return {
    ...entry,
    status: entry.status ?? null,
    note: entry.note ?? null,
    created_at: entry.created_at ?? entry.createdAt ?? null,
    changed_by: entry.changed_by ?? entry.changedBy ?? null,
  }
}

export function adaptPaymentCollection(collection) {
  if (!collection) return null
  const rawRef = collection.transaction_ref ?? collection.transactionRef ?? null
  return {
    ...collection,
    amount: collection.amount ?? null,
    currency: collection.currency || 'AED',
    collected_by: collection.collected_by ?? collection.collectedBy ?? null,
    transaction_ref: rawRef,
    transaction_ref_masked:
      collection.transaction_ref_masked
      ?? maskTransactionRef(rawRef),
    note: collection.note ?? null,
  }
}

export function adaptOrder(order) {
  if (!order || typeof order !== 'object') return order
  const items = (order.items ?? order.order_items ?? []).map(adaptOrderItem)
  const statusHistory = (order.status_history ?? order.order_status_history ?? []).map(adaptStatusHistory)
  const customers = order.customer_id && typeof order.customer_id === 'object'
    ? order.customer_id
    : order.customers ?? null

  return {
    ...order,
    customers,
    order_items: items,
    order_status_history: statusHistory,
    returns: order.returns ?? [],
    payment_collection: adaptPaymentCollection(order.payment_collection ?? null),
    payment_events: order.payment_events ?? order.paymentEvents ?? [],
  }
}

export function orderDisplayTotal(order) {
  if (!order) return 0
  if (order.final_total != null) return Number(order.final_total)
  if (order.estimated_total != null) return Number(order.estimated_total)
  return Number(order.total || 0)
}

export function isEstimatedPricing(order) {
  return order?.pricing_mode === 'cod_delivery' && order?.final_total == null && order?.payment_status !== 'paid'
}
