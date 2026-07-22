import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { mapSchemeEnrollment } from '@/lib/schemeAdapters'

const PAGE_SIZE = 30

export function useAdminCustomers({ search = '', status = 'all', page = 1 } = {}) {
  return useQuery({
    queryKey: ['admin-customers', search, status, page],
    queryFn: async () => {
      const { data, meta } = await api.getWithMeta('/admin/customers', {
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        status: status !== 'all' ? status : undefined,
      })
      return {
        customers: data || [],
        page: meta?.page || page,
        limit: meta?.limit || PAGE_SIZE,
        total: meta?.total || 0,
        pages: meta?.pages || 1,
      }
    },
  })
}

export { PAGE_SIZE as CUSTOMERS_PAGE_SIZE }

export function useAdminCustomer(customerId) {
  return useQuery({
    queryKey: ['admin-customer', customerId],
    queryFn: async () => {
      const [customer, ordersResult, enrollments] = await Promise.all([
        api.get(`/admin/customers/${customerId}`),
        api.getWithMeta('/admin/orders', { page: 1, limit: 50, customer_id: customerId }),
        api.get('/admin/schemes/enrollments/all'),
      ])
      const orders = ordersResult.data || []
      return {
        ...customer,
        orders,
        enrollments: (enrollments || [])
          .filter((item) => (item.customer_id?.id || item.customer_id) === customerId)
          .map((row) => mapSchemeEnrollment({
            ...row,
            schemes: row.scheme_id,
            scheme_installments: row.installments || [],
          })),
      }
    },
    enabled: !!customerId,
  })
}

export function useAdminCustomerMutations() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }) => api.patch(`/admin/customers/${id}`, { is_active }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] })
      queryClient.invalidateQueries({ queryKey: ['admin-customer', vars.id] })
    },
  })
}
