import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

const PAGE_SIZE = 50

const adapt = (row) => ({
  ...row,
  product_variants: row.variant_id && typeof row.variant_id === 'object'
    ? {
      ...row.variant_id,
      variant_label: row.variant_id.label,
      products: row.variant_id.product_id,
    }
    : row.product_variants,
})

export function useAdminStockMovements({ reason, search = '', page = 1 } = {}) {
  return useQuery({
    queryKey: ['admin-stock-movements', reason, search, page],
    queryFn: async () => {
      const { data, meta } = await api.getWithMeta('/admin/stock-ledger', {
        page,
        limit: PAGE_SIZE,
        reason: reason && reason !== 'all' ? reason : undefined,
        search: search.trim() || undefined,
      })
      return {
        rows: (data || []).map(adapt),
        total: meta?.total || 0,
        page: meta?.page || page,
        pageSize: meta?.limit || PAGE_SIZE,
        pages: meta?.pages || 1,
      }
    },
    staleTime: 30000,
  })
}

export function useAdminOrderStockMovements(orderId) {
  return useQuery({
    queryKey: ['admin-stock-movements', 'order', orderId],
    queryFn: async () => {
      const { data } = await api.getWithMeta('/admin/stock-ledger', {
        page: 1,
        limit: 100,
        reference_type: 'order',
        reference_id: orderId,
      })
      return (data || []).map(adapt)
    },
    enabled: !!orderId,
  })
}
