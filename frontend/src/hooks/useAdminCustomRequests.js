import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

const KEY = 'admin-custom-requests'

function adapt(item) {
  if (!item) return null
  return {
    ...item,
    customer: item.customer_id && typeof item.customer_id === 'object' ? item.customer_id : item.customer,
  }
}

export function useAdminCustomRequests(status) {
  return useQuery({
    queryKey: [KEY, status],
    queryFn: async () => (await api.get('/admin/custom-requests', {
      status: status && status !== 'all' ? status : undefined,
    })).map(adapt),
  })
}

export function useAdminCustomRequest(id) {
  return useQuery({
    queryKey: [KEY, 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => adapt(await api.get(`/admin/custom-requests/${id}`)),
  })
}

export function useAdminCustomRequestAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action, body }) => api.post(`/admin/custom-requests/${id}/${action}`, body || {}),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [KEY] })
      if (vars?.id) queryClient.invalidateQueries({ queryKey: [KEY, 'detail', vars.id] })
    },
  })
}
