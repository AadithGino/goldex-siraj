import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'

const KEY = 'sell-requests'

export function useMySellRequests() {
  const { isAuthenticated } = useCustomerAuth()
  return useQuery({
    queryKey: [KEY],
    queryFn: () => api.get('/customer/sell-requests'),
    enabled: isAuthenticated,
  })
}

export function useCreateSellRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.post('/customer/sell-requests', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] })
      queryClient.invalidateQueries({ queryKey: ['admin-sell-requests'] })
    },
  })
}

export function useSellRequestAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action, body }) => api.post(`/customer/sell-requests/${id}/${action}`, body || {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] })
      queryClient.invalidateQueries({ queryKey: ['admin-sell-requests'] })
    },
  })
}
