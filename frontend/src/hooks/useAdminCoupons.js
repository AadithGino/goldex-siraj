import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toCouponPayload } from '@/lib/couponPayload'

function invalidateCouponQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
  queryClient.invalidateQueries({ queryKey: ['admin-coupon-usage-summary'] })
  queryClient.invalidateQueries({ queryKey: ['admin-coupon-usage'] })
}

export function useAdminCoupons(enabled = true, query = {}) {
  return useQuery({
    queryKey: ['admin-coupons', query],
    enabled,
    queryFn: () => api.getWithMeta('/admin/coupons', {
      limit: query.limit ?? 25,
      page: query.page ?? 1,
      search: query.search,
      is_active: query.is_active,
      status: query.status,
    }),
  })
}

export function useAdminCouponUsageSummary(enabled = true) {
  return useQuery({
    queryKey: ['admin-coupon-usage-summary'],
    enabled,
    queryFn: () => api.get('/admin/coupons/usage-summary'),
    staleTime: 0,
  })
}

export function useAdminCouponUsage(couponId, query = {}, enabled = true) {
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  return useQuery({
    queryKey: ['admin-coupon-usage', couponId, page, limit],
    enabled: Boolean(enabled && couponId),
    queryFn: () => api.getWithMeta(`/admin/coupons/${couponId}/usage`, { page, limit }),
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

export function useAdminCouponMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => invalidateCouponQueries(queryClient)
  const create = useMutation({
    mutationFn: (body) => api.post('/admin/coupons', toCouponPayload(body)),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/admin/coupons/${id}`, toCouponPayload(body)),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/admin/coupons/${id}`),
    onSuccess: invalidate,
  })
  return { create, update, remove }
}

export { invalidateCouponQueries }
