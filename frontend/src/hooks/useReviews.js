import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
export function useProductReviews(productId) { return useQuery({ queryKey: ['reviews', productId], queryFn: () => api.get(`/customer/reviews/product/${productId}`), enabled: !!productId }) }
export function useMyReview(productId) { const { isAuthenticated } = useCustomerAuth(); return useQuery({ queryKey: ['my-review', productId], queryFn: () => api.get(`/customer/reviews/mine/${productId}`), enabled: isAuthenticated && !!productId }) }
export function useSubmitReview() { const queryClient = useQueryClient(); return useMutation({ mutationFn: ({ product_id, rating, title, body }) => api.post('/customer/reviews', { product_id, rating, title, comment: body }), onSuccess: (_, vars) => { queryClient.invalidateQueries({ queryKey: ['reviews', vars.product_id] }); queryClient.invalidateQueries({ queryKey: ['my-review', vars.product_id] }); queryClient.invalidateQueries({ queryKey: ['admin-reviews'] }) } }) }
