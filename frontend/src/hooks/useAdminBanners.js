import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toBannerPayload } from '@/lib/bannerPayload'

export function useAdminBanners(query = {}) {
  const page = query.page ?? 1
  const limit = query.limit ?? 25
  return useQuery({
    queryKey: ['admin-banners', page, limit, query.search, query.position],
    queryFn: () => api.getWithMeta('/admin/catalog/banners', {
      page,
      limit,
      search: query.search,
      position: query.position,
    }),
  })
}

export function useAdminBannerMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-banners'] })
    qc.invalidateQueries({ queryKey: ['banners'] })
  }
  const create = useMutation({
    mutationFn: (body) => api.post('/admin/catalog/banners', toBannerPayload(body)),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/admin/catalog/banners/${id}`, toBannerPayload(body, { partial: true })),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/admin/catalog/banners/${id}`),
    onSuccess: invalidate,
  })
  return { create, update, remove }
}
