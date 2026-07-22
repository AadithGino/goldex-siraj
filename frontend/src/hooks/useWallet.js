import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
export function useWalletBalance(enabled = true) { const { isAuthenticated } = useCustomerAuth(); return useQuery({ queryKey: ['wallet-balance'], queryFn: async () => Number((await api.get('/customer/wallet')).balance || 0), enabled: enabled && isAuthenticated }) }
export function useWalletTransactions(enabled = true) { const { isAuthenticated } = useCustomerAuth(); return useQuery({ queryKey: ['wallet-transactions'], queryFn: () => api.get('/customer/wallet/transactions'), enabled: enabled && isAuthenticated }) }
export function useWalletTransaction(id) { const query = useWalletTransactions(); return { ...query, data: query.data?.find((item) => item.id === id) || null } }
export function useAdminCustomerWallet(customerId) { return useQuery({ queryKey: ['admin-customer-wallet', customerId], queryFn: () => api.get(`/admin/customers/${customerId}/wallet`), enabled: !!customerId }) }
