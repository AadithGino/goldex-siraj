import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useSalesReport(from, to) {
  return useQuery({
    queryKey: ['sales-report', from, to],
    queryFn: () => api.get('/admin/reports/sales', { from, to }),
    enabled: !!from && !!to,
  })
}

export function useTopProducts(limit = 10, from, to) {
  return useQuery({
    queryKey: ['top-products', limit, from, to],
    queryFn: () => api.get('/admin/reports/top-products', { limit, from, to }),
    enabled: !!from && !!to,
  })
}
