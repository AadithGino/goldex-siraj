import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
export function useWishlist() {
  const { isAuthenticated } = useCustomerAuth(); const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['wishlist'], queryFn: () => api.get('/customer/wishlist'), enabled: isAuthenticated })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['wishlist'] })
  const add = useMutation({ mutationFn: (productId) => api.post('/customer/wishlist', { product_id: productId }), onSuccess: invalidate })
  const remove = useMutation({ mutationFn: (productId) => api.delete(`/customer/wishlist/${productId}`), onSuccess: invalidate })
  const items = query.data || []; const productIds = new Set(items.map((item) => item.product_id))
  return { items, isLoading: query.isLoading, isWishlisted: (id) => productIds.has(id), add: add.mutateAsync, remove: remove.mutateAsync, toggle: ({ productId, isWishlisted }) => isWishlisted ? remove.mutateAsync(productId) : add.mutateAsync(productId), isPending: add.isPending || remove.isPending }
}
