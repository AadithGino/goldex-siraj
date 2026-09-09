import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { normalizeGoldRates } from '@/lib/rateAdapters'

export function useAdminGoldRates() {
  return useQuery({
    queryKey: ['admin-gold-rates'],
    queryFn: async () => normalizeGoldRates(await api.get('/admin/rates/gold')),
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

export function useSetGoldRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ purity, rate }) => api.post('/admin/rates/gold', { purity, rate_per_gram: rate }),
    onSuccess: () => ['admin-gold-rates', 'gold-rates', 'price-breakup'].forEach((key) => qc.invalidateQueries({ queryKey: [key] })),
  })
}

export function useAdminGoldBuybackRates() {
  return useQuery({
    queryKey: ['admin-gold-buyback-rates'],
    queryFn: async () => normalizeGoldRates(await api.get('/admin/rates/gold-buyback')),
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

export function useSetGoldBuybackRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ purity, rate }) => api.post('/admin/rates/gold-buyback', { purity, rate_per_gram: rate }),
    onSuccess: () => ['admin-gold-buyback-rates', 'gold-buyback-rates'].forEach((key) => qc.invalidateQueries({ queryKey: [key] })),
  })
}
