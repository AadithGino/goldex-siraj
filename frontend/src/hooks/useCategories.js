import { useQuery } from '@tanstack/react-query'
import { getCategories } from '@/lib/catalogApi'

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 1000 * 60 * 10,
  })
}

export function useCategoryBySlug(slug) {
  return useQuery({
    queryKey: ['category', slug],
    queryFn: async () => {
      const categories = await getCategories()
      return categories.find((c) => c.slug === slug) || null
    },
    enabled: !!slug,
  })
}
