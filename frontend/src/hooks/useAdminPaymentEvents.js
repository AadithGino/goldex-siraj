import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
export function useAdminPaymentEvents(orderId) { return useQuery({ queryKey: ['admin-payment-events', orderId], queryFn: async () => (await api.get('/admin/payment-events')).filter((item) => (item.order_id?.id || item.order_id) === orderId), enabled: !!orderId, staleTime: 30000 }) }
