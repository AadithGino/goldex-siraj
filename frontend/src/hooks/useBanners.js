import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * Storefront banners — server already filters active + Dubai date window.
 * Pass position to request the matching slot; paginate intentionally.
 */
export function useBanners(position, { page = 1, limit = 25 } = {}) {
  return useQuery({
    queryKey: ['banners', position, page, limit],
    queryFn: async () => {
      const { data } = await api.getWithMeta('/customer/catalog/banners', {
        page,
        limit,
        ...(position ? { position } : {}),
      })
      return data || []
    },
    staleTime: 1000 * 60 * 5,
  })
}
