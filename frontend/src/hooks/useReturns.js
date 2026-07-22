import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
export function useOrderReturns(orderId) { const { isAuthenticated } = useCustomerAuth(); return useQuery({ queryKey: ['returns', orderId], queryFn: async () => (await api.get('/customer/returns')).filter((item) => item.order_id?.id === orderId || item.order_id === orderId), enabled: isAuthenticated && !!orderId }) }
export function useCreateReturn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.post('/customer/returns', body),
    onSuccess: (_, vars) => {
      ;[['returns', vars.order_id], ['orders'], ['order', vars.order_id], ['admin-returns'], ['admin-orders'], ['admin-coupons'], ['admin-coupon-usage-summary'], ['admin-coupon-usage']].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
    },
  })
}
