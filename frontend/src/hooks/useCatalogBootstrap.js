import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useCatalogBootstrap() {
  return useQuery({
    queryKey: ['catalog-bootstrap'],
    queryFn: () => api.get('/customer/catalog/bootstrap'),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
