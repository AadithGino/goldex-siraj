import { useQuery } from '@tanstack/react-query'
import { getBrands } from '@/lib/catalogApi'

export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: async () => getBrands(),
  })
}

export function useBrandBySlug(slug) {
  const brandsQuery = useBrands()
  const brand = (brandsQuery.data || []).find((item) => item.slug === slug) || null
  return {
    ...brandsQuery,
    data: brand,
  }
}
