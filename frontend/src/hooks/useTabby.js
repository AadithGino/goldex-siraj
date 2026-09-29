import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * Background pre-scoring. Fail-safe: request errors report Tabby as available so the
 * checkout is never blocked; session creation re-checks eligibility.
 */
export function useTabbyEligibility({ amount, addressId, lang, enabled }) {
  const value = Math.round((Number(amount) || 0) * 100) / 100
  return useQuery({
    queryKey: ['tabby-eligibility', value, addressId || null, lang],
    queryFn: async () => {
      try {
        return await api.post('/customer/orders/tabby/eligibility', {
          amount: value,
          address_id: addressId || null,
          lang,
        })
      } catch {
        return { available: true, reason: null }
      }
    },
    enabled: Boolean(enabled) && value > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useTabbyAbandon() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orderId) => api.post(`/customer/orders/${orderId}/tabby-abandon`),
    onSettled: () => {
      ;['cart', 'orders', 'order', 'wallet-balance'].forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] })
      })
    },
  })
}
