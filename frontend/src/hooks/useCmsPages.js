import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toCmsPayload } from '@/lib/cmsPayload'

export function useCmsPage(slug) {
  return useQuery({
    queryKey: ['cms-page', slug],
    queryFn: () => api.get(`/customer/catalog/cms-pages/${slug}`),
    enabled: !!slug,
  })
}

/** Known policy pages use direct slug routes; do not depend on a capped global list. */
export function usePublishedCmsPages(query = {}) {
  const page = query.page ?? 1
  const limit = query.limit ?? 25
  return useQuery({
    queryKey: ['cms-pages-published', page, limit],
    queryFn: () => api.getWithMeta('/customer/catalog/cms-pages', { page, limit }),
    staleTime: 600_000,
  })
}

export function useAdminCmsPages(query = {}) {
  const page = query.page ?? 1
  const limit = query.limit ?? 25
  return useQuery({
    queryKey: ['admin-cms', page, limit, query.search],
    queryFn: () => api.getWithMeta('/admin/catalog/cms-pages', {
      page,
      limit,
      search: query.search,
    }),
  })
}

export function useAdminCmsMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-cms'] })
    queryClient.invalidateQueries({ queryKey: ['cms-pages-published'] })
    queryClient.invalidateQueries({ queryKey: ['cms-page'] })
  }
  const create = useMutation({
    mutationFn: (body) => api.post('/admin/catalog/cms-pages', toCmsPayload(body)),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/admin/catalog/cms-pages/${id}`, toCmsPayload(body, { partial: true })),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/admin/catalog/cms-pages/${id}`),
    onSuccess: invalidate,
  })
  return { create, update, remove }
}
