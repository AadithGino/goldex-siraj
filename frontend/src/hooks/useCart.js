import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'

export function useCart() {
  const { isAuthenticated } = useCustomerAuth()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['cart'], queryFn: () => api.get('/customer/cart'), enabled: isAuthenticated })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['cart'] })
  const add = useMutation({ mutationFn: ({ variantId, qty = 1, customizationRequest = null }) => api.post('/customer/cart', { variant_id: variantId, qty, customization_request: customizationRequest }), onSuccess: invalidate })
  const updateQty = useMutation({ mutationFn: ({ itemId, qty }) => qty < 1 ? api.delete(`/customer/cart/${itemId}`) : api.patch(`/customer/cart/${itemId}`, { qty }), onSuccess: invalidate })
  const updateVariant = useMutation({ mutationFn: ({ itemId, variantId }) => api.patch(`/customer/cart/${itemId}`, { variant_id: variantId }), onSuccess: invalidate })
  const remove = useMutation({ mutationFn: (itemId) => api.delete(`/customer/cart/${itemId}`), onSuccess: invalidate })
  const clear = useMutation({ mutationFn: () => api.delete('/customer/cart'), onSuccess: invalidate })
  const items = query.data || []
  return { items, itemCount: items.reduce((sum, item) => sum + item.qty, 0), isLoading: query.isLoading, add: add.mutateAsync, updateQty: updateQty.mutateAsync, updateVariant: updateVariant.mutateAsync, remove: remove.mutateAsync, clear: clear.mutateAsync, isAdding: add.isPending, isUpdating: updateQty.isPending || updateVariant.isPending }
}
