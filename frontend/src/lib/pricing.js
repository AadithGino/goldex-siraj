import { api } from '@/lib/api'
import { getWalletBalance as getWalletBalanceApi } from '@/lib/commerceApi'

export function formatAED(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return 'AED 0'
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount))
}
export const formatINR = formatAED
export const formatMoney = formatAED
export const getBreakup = (variantId) => api.get(`/customer/pricing/${variantId}`)
export const getWalletBalance = () => getWalletBalanceApi()
