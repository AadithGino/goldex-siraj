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

export function usePlaceOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ addressId, couponCode, paymentMethod = 'cod', walletApply = 0, isGift = false, giftNote = null, idempotencyKey }) =>
      api.post('/customer/orders', {
        address_id: addressId,
        coupon_code: couponCode || null,
        payment_method: paymentMethod,
        wallet_use: walletApply,
        idempotency_key: idempotencyKey,
        is_gift: isGift,
        gift_note: isGift ? giftNote?.trim() || null : null,
      }).then((order) => {
        const adapted = adaptOrder(order)
        return { ...adapted, order_id: adapted.id }
      }),
    onSuccess: () => {
      ;['cart', 'orders', 'wallet-balance', 'admin-coupons', 'admin-coupon-usage-summary', 'admin-coupon-usage'].forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] })
      })
    },
  })
}
