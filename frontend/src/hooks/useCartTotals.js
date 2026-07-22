import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * Authoritative cart totals from POST /customer/cart/quote.
 * No frontend VAT / shipping / discount mathematics.
 */
export function useCartTotals(cartItems, appliedCouponCode = null) {
  const itemKey = (cartItems || [])
    .map((item) => `${item.id || item.variant_id}:${item.qty}:${item.variant_id}`)
    .join('|')

  const quoteQuery = useQuery({
    queryKey: ['cart-quote', itemKey, appliedCouponCode || ''],
    queryFn: async () => {
      const body = appliedCouponCode ? { coupon_code: appliedCouponCode } : {}
      return api.post('/customer/cart/quote', body)
    },
    enabled: Array.isArray(cartItems) && cartItems.length > 0,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  })

  const quote = quoteQuery.data
  const totals = quote?.totals || {}
  const lines = quote?.lines || []

  const lineByVariant = new Map(lines.map((line) => [String(line.variant_id), line]))
  const linePrices = (cartItems || []).map((item) => {
    const line = lineByVariant.get(String(item.variant_id))
    const breakup = line?.breakup
    return {
      item,
      breakup,
      lineTotal: breakup?.line_total != null ? Number(breakup.line_total) : null,
    }
  })

  const subtotal = Number(totals.subtotal || 0)
  const discount = Number(totals.discount_amount || 0)
  const shipping = Number(totals.shipping_fee || 0)
  const taxAmount = Number(totals.tax_amount || 0)
  const total = Number(totals.total || 0)

  return {
    subtotal,
    subtotalBeforeVat: subtotal,
    taxableSubtotalBeforeVat: Number(totals.standard_rated_total || 0),
    discount,
    shipping,
    tax: taxAmount,
    taxAmount,
    taxPercent: Number(totals.vat_percent || 0),
    taxMode: totals.tax_mode || 'exclusive',
    afterDiscount: Math.max(0, subtotal - discount),
    total: quoteQuery.isError ? null : total,
    isLoading: quoteQuery.isLoading || quoteQuery.isFetching,
    linePrices,
    taxBreakdown: totals.tax_breakdown || {
      standard_rated_total: totals.standard_rated_total || 0,
      zero_rated_total: totals.zero_rated_total || 0,
      exempt_total: totals.exempt_total || 0,
      vat_total: taxAmount,
    },
    quote,
    coupon: quote?.coupon || null,
    error: quoteQuery.error,
    refetch: quoteQuery.refetch,
  }
}
