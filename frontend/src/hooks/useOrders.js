import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { adaptOrder } from '@/lib/orderAdapter'

export function useOrders() {
  const { isAuthenticated } = useCustomerAuth()
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => (await api.get('/customer/orders')).map(adaptOrder),
    enabled: isAuthenticated,
  })
}

export function useOrder(orderId) {
  const { isAuthenticated } = useCustomerAuth()
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => adaptOrder(await api.get(`/customer/orders/${orderId}`)),
    enabled: isAuthenticated && !!orderId,
  })
}

export function usePaymobCheckout() {
  return useMutation({
    mutationFn: (orderIdOrPayload) => {
      const orderId = typeof orderIdOrPayload === 'string'
        ? orderIdOrPayload
        : orderIdOrPayload?.orderId
      const paymentProvider = typeof orderIdOrPayload === 'object'
        ? orderIdOrPayload?.paymentProvider
        : null
      const lang = typeof orderIdOrPayload === 'object' ? orderIdOrPayload?.lang : null
      return api.post(`/customer/orders/${orderId}/online-checkout`, {
        ...(paymentProvider ? { payment_provider: paymentProvider } : {}),
        ...(lang ? { lang } : {}),
      })
    },
  })
}

export function useChangeOrderPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, paymentMethod, paymentProvider = null, lang = null }) => {
      const order = await api.post(`/customer/orders/${orderId}/payment-method`, {
        payment_method: paymentMethod,
        ...(paymentProvider ? { payment_provider: paymentProvider } : {}),
        ...(lang ? { lang } : {}),
      })
      return {
        ...adaptOrder(order),
        checkout_url: order.checkout_url || null,
      }
    },
    onSuccess: (order) => {
      if (order?.id) queryClient.setQueryData(['order', order.id], adaptOrder(order))
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order'] })
    },
  })
}

export function usePaymobConfirm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, params }) => api.post(`/customer/orders/${orderId}/online-confirm`, params),
    onSuccess: (order) => {
      if (order?.id) queryClient.setQueryData(['order', order.id], adaptOrder(order))
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order'] })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}

export function usePlaceOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ addressId, couponCode, paymentMethod = 'cod', paymentProvider = null, walletApply = 0, isGift = false, giftNote = null, idempotencyKey, lang }) =>
      api.post('/customer/orders', {
        address_id: addressId,
        lang: lang || undefined,
        coupon_code: couponCode || null,
        payment_method: paymentMethod,
        payment_provider: paymentProvider || undefined,
        wallet_use: walletApply,
        idempotency_key: idempotencyKey,
        is_gift: isGift,
        gift_note: isGift ? giftNote?.trim() || null : null,
      }).then((order) => {
        const adapted = adaptOrder(order)
        return {
          ...adapted,
          order_id: adapted.id,
          checkout_url: order.checkout_url || null,
        }
      }),
    onSuccess: () => {
      ;['cart', 'orders', 'wallet-balance', 'admin-coupons', 'admin-coupon-usage-summary', 'admin-coupon-usage'].forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] })
      })
    },
  })
}
