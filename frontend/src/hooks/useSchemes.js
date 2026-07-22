import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { mapSchemeEnrollment } from '@/lib/schemeAdapters'
import {
  toInstallmentPayPayload,
  toSchemeCompletePayload,
  toSchemePayload,
} from '@/lib/schemePayload'

function adaptEnrollment(row) {
  return mapSchemeEnrollment({
    ...row,
    schemes: row.scheme_id && typeof row.scheme_id === 'object' ? row.scheme_id : row.schemes,
    customers: row.customer_id && typeof row.customer_id === 'object' ? row.customer_id : row.customers,
    scheme_installments: row.installments || row.scheme_installments || [],
  })
}

export function useSchemes() {
  return useQuery({
    queryKey: ['schemes'],
    queryFn: async () => {
      const result = await api.getWithMeta('/customer/schemes', { limit: 100 })
      return result.data
    },
  })
}

export function useMyEnrollments(query = {}) {
  const { isAuthenticated } = useCustomerAuth()
  return useQuery({
    queryKey: ['scheme-enrollments', query],
    enabled: isAuthenticated,
    queryFn: async () => {
      const result = await api.getWithMeta('/customer/schemes/enrollments', {
        page: query.page ?? 1,
        limit: query.limit ?? 50,
        status: query.status,
      })
      const rows = (result.data || []).map(adaptEnrollment)
      return Object.assign(rows, { meta: result.meta })
    },
  })
}

export function useMyEnrollment(id) {
  const { isAuthenticated } = useCustomerAuth()
  return useQuery({
    queryKey: ['scheme-enrollment', id],
    enabled: Boolean(isAuthenticated && id),
    queryFn: async () => adaptEnrollment(await api.get(`/customer/schemes/enrollments/${id}`)),
  })
}

export function useEnrollScheme() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ scheme_id }) => api.post('/customer/schemes/enrollments', { scheme_id })
      .then((row) => ({ ...adaptEnrollment(row), enrollment_id: row.id })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheme-enrollments'] }),
  })
}

export function usePaySchemeInstallment() {
  return useMutation({
    mutationFn: async () => {
      throw new Error('Contact the store to arrange bank, card, or cash payment for this installment.')
    },
  })
}

export function useAdminSchemes(query = {}) {
  return useQuery({
    queryKey: ['admin-schemes', query],
    queryFn: () => api.getWithMeta('/admin/schemes', {
      page: query.page ?? 1,
      limit: query.limit ?? 25,
      search: query.search,
      status: query.status,
    }),
  })
}

export function useAdminSchemeEnrollments(query = {}) {
  return useQuery({
    queryKey: ['admin-scheme-enrollments', query],
    queryFn: async () => {
      const result = await api.getWithMeta('/admin/schemes/enrollments/all', {
        page: query.page ?? 1,
        limit: query.limit ?? 25,
        search: query.search,
        status: query.status,
      })
      return {
        data: (result.data || []).map(adaptEnrollment),
        meta: result.meta,
      }
    },
  })
}

export function useAdminSchemeEnrollment(id) {
  return useQuery({
    queryKey: ['admin-scheme-enrollment', id],
    enabled: Boolean(id),
    queryFn: async () => adaptEnrollment(await api.get(`/admin/schemes/enrollments/${id}`)),
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

export function useAdminSchemeMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    ;['admin-schemes', 'schemes', 'admin-scheme-enrollments', 'admin-scheme-enrollment', 'scheme-enrollments', 'scheme-enrollment', 'wallet-balance']
      .forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
  }

  const create = useMutation({
    mutationFn: (body) => api.post('/admin/schemes', toSchemePayload(body)),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/admin/schemes/${id}`, toSchemePayload(body)),
    onSuccess: invalidate,
  })
  const recordPayment = useMutation({
    mutationFn: ({ installmentId, amount, paymentMethod, transactionRef, note }) => api.post(
      `/admin/schemes/installments/${installmentId}/pay`,
      toInstallmentPayPayload({
        amount,
        payment_method: paymentMethod,
        transaction_ref: transactionRef,
        note,
      }),
    ),
    onSuccess: invalidate,
  })
  const updateEnrollmentStatus = useMutation({
    mutationFn: ({ enrollmentId, status, reason }) => api.patch(
      `/admin/schemes/enrollments/${enrollmentId}`,
      { status, reason: reason || null },
    ),
    onSuccess: invalidate,
  })
  const completeEnrollment = useMutation({
    mutationFn: ({ enrollmentId, note }) => api.post(
      `/admin/schemes/enrollments/${enrollmentId}/complete`,
      toSchemeCompletePayload({ note }),
    ),
    onSuccess: invalidate,
  })

  return { create, update, recordPayment, updateEnrollmentStatus, completeEnrollment }
}
