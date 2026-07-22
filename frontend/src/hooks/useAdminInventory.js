import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'

const adapt = (row) => ({
  ...row,
  variant_label: row.label,
  products: row.product_id && typeof row.product_id === 'object' ? row.product_id : row.products,
})

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `stock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function invalidateInventory(queryClient) {
  ;['admin-inventory-variants', 'admin-low-stock', 'admin-products', 'admin-stock-ledger'].forEach((key) => {
    queryClient.invalidateQueries({ queryKey: [key] })
  })
}

/** Paginated low-stock (server-side). */
export function useAdminLowStock({ page = 1, limit = 50 } = {}) {
  return useQuery({
    queryKey: ['admin-low-stock', page, limit],
    queryFn: async () => {
      const { data, meta } = await api.getWithMeta('/admin/inventory/low-stock', { page, limit })
      return { data: (data || []).map(adapt), meta }
    },
    staleTime: 60_000,
  })
}

/**
 * Server-paginated inventory variants.
 * @param {{ page?: number, limit?: number, search?: string, stock_state?: string }} query
 */
export function useAdminInventoryVariants(query = {}) {
  const page = query.page ?? 1
  const limit = query.limit ?? 50
  const search = query.search || ''
  const stockState = query.stock_state || 'all'
  return useQuery({
    queryKey: ['admin-inventory-variants', page, limit, search, stockState],
    queryFn: async () => {
      const { data, meta } = await api.getWithMeta('/admin/inventory/variants', {
        page,
        limit,
        search: search || undefined,
        stock_state: stockState === 'all' ? undefined : stockState,
      })
      return { data: (data || []).map(adapt), meta }
    },
    staleTime: 30_000,
  })
}

/** @deprecated Prefer useAdminInventoryVariants with server pagination. */
export function useAdminAllVariants() {
  return useAdminInventoryVariants({ page: 1, limit: 100 })
}

export function useAdjustVariantStock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, delta, note, idempotency_key }) => {
      const d = Number(delta)
      if (!Number.isInteger(d) || d === 0) throw new Error('Stock delta must be a non-zero integer')
      const key = idempotency_key || newIdempotencyKey()
      return api.post(`/admin/inventory/variants/${id}/adjust`, {
        delta: d,
        reason: 'admin_adjustment',
        note,
        idempotency_key: key,
      })
    },
    onSuccess: () => invalidateInventory(queryClient),
  })
}

export function useUpdateVariantStock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, stock_qty, note, expected_before, idempotency_key }) => {
      if (stock_qty === '' || stock_qty == null) {
        throw new Error('Stock quantity is required')
      }
      const qty = Number(stock_qty)
      if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty < 0) {
        throw new Error('Stock quantity must be a non-negative integer')
      }
      if (expected_before == null || !Number.isInteger(Number(expected_before))) {
        throw new Error('expected_before is required for absolute stock set')
      }
      const key = idempotency_key || newIdempotencyKey()
      try {
        return await api.post(`/admin/inventory/variants/${id}/set-stock`, {
          qty,
          expected_before: Number(expected_before),
          reason: 'admin_adjustment',
          note,
          idempotency_key: key,
        })
      } catch (err) {
        if (err instanceof ApiError && err.code === 'STOCK_VERSION_CONFLICT') {
          invalidateInventory(queryClient)
        }
        throw err
      }
    },
    onSuccess: () => invalidateInventory(queryClient),
  })
}

export { newIdempotencyKey }
