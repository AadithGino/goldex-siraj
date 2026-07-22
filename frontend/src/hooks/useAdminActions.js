import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useFinalizeCodOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, amountCollected, note }) => api.post(`/admin/orders/${orderId}/cod-handover`, {
      amount_collected: amountCollected,
      note,
    }),
    onSuccess: (_data, vars) => {
      ;['admin-orders', 'orders', 'admin-dashboard'].forEach((key) => qc.invalidateQueries({ queryKey: [key] }))
      qc.invalidateQueries({ queryKey: ['admin-order', vars.orderId] })
    },
  })
}

export function useMarkManualOrderPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, paymentMode, transactionRef, amountCollected, note }) => api.post(`/admin/orders/${orderId}/manual-payment`, {
      payment_mode: paymentMode,
      transaction_ref: transactionRef,
      amount_collected: amountCollected,
      note,
    }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-order', vars.orderId] })
      qc.invalidateQueries({ queryKey: ['admin-orders'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
  })
}

export function useCreditSchemePayout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ enrollmentId, note }) => api.post(`/admin/schemes/enrollments/${enrollmentId}/complete`, {
      note: note || undefined,
    }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-scheme-enrollment', vars.enrollmentId] })
      qc.invalidateQueries({ queryKey: ['admin-scheme-enrollments'] })
      qc.invalidateQueries({ queryKey: ['wallet-balance'] })
      qc.invalidateQueries({ queryKey: ['wallet-transactions'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
  })
}
