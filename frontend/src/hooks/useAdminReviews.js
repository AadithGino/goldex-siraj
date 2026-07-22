import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
const adapt = (row) => ({ ...row, products: row.product_id && typeof row.product_id === 'object' ? row.product_id : row.products, customers: row.customer_id && typeof row.customer_id === 'object' ? row.customer_id : row.customers })
export function useAdminReviews(status) { return useQuery({ queryKey: ['admin-reviews', status], queryFn: async () => (await api.get('/admin/reviews', { status: status && status !== 'all' ? status : undefined })).map(adapt) }) }
export function useModerateReview() { const queryClient = useQueryClient(); return useMutation({ mutationFn: ({ id, status }) => api.patch(`/admin/reviews/${id}`, { status }), onSuccess: () => ['admin-reviews', 'reviews', 'products', 'admin-products'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] })) }) }
