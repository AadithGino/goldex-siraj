import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
export function useAddresses() {
  const { isAuthenticated } = useCustomerAuth(); const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['addresses'], queryFn: () => api.get('/customer/addresses'), enabled: isAuthenticated })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['addresses'] })
  const create = useMutation({ mutationFn: (body) => api.post('/customer/addresses', body), onSuccess: invalidate })
  const update = useMutation({ mutationFn: ({ id, ...body }) => api.patch(`/customer/addresses/${id}`, body), onSuccess: invalidate })
  const remove = useMutation({ mutationFn: (id) => api.delete(`/customer/addresses/${id}`), onSuccess: invalidate })
  return { addresses: query.data || [], isLoading: query.isLoading, create: create.mutateAsync, update: update.mutateAsync, remove: remove.mutateAsync, isSaving: create.isPending || update.isPending }
}
