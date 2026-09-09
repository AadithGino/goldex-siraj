import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'

const KEY = 'custom-requests'

export function useMyCustomRequests() {
  const { isAuthenticated } = useCustomerAuth()
  return useQuery({
    queryKey: [KEY],
    queryFn: () => api.get('/customer/custom-requests'),
    enabled: isAuthenticated,
  })
}

export function useCreateCustomRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.post('/customer/custom-requests', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] })
      queryClient.invalidateQueries({ queryKey: ['admin-custom-requests'] })
    },
  })
}

export function useCustomRequestAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action, body }) => api.post(`/customer/custom-requests/${id}/${action}`, body || {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] })
      queryClient.invalidateQueries({ queryKey: ['admin-custom-requests'] })
    },
  })
}
