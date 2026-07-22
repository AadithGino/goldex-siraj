import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { adaptOrder } from '@/lib/orderAdapter'

const PAGE_SIZE = 25

export function useAdminOrders({ status, search = '', dateFrom = '', dateTo = '', page = 1 } = {}) {
  return useQuery({
    queryKey: ['admin-orders', status, search, dateFrom, dateTo, page],
    queryFn: async () => {
      const query = {
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        status: status && status !== 'all' ? status : undefined,
      }
      const { data, meta } = await api.getWithMeta('/admin/orders', query)
      return {
        orders: (data || []).map(adaptOrder),
        page: meta?.page || page,
        limit: meta?.limit || PAGE_SIZE,
        total: meta?.total || 0,
        pages: meta?.pages || 1,
      }
    },
  })
}

export { PAGE_SIZE as ORDERS_PAGE_SIZE }

export function useAdminOrder(orderId) {
  return useQuery({
    queryKey: ['admin-order', orderId],
    queryFn: async () => adaptOrder(await api.get(`/admin/orders/${orderId}`)),
    enabled: !!orderId,
  })
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, status, note }) => api.patch(`/admin/orders/${orderId}/status`, { status, note }),
    onSuccess: (_, vars) => {
      ;['admin-orders', 'admin-dashboard', 'orders', 'admin-coupons', 'admin-coupon-usage-summary', 'admin-coupon-usage'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
      queryClient.invalidateQueries({ queryKey: ['admin-order', vars.orderId] })
      queryClient.invalidateQueries({ queryKey: ['order', vars.orderId] })
    },
  })
}

export const ORDER_STATUS_FLOW = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  partially_returned: [],
  cancelled: [],
  returned: [],
}
