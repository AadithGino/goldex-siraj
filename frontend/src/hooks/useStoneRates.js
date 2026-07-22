import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
export function useStoneRates() { return useQuery({ queryKey: ['stone-rates'], queryFn: async () => ((await api.get('/customer/catalog/bootstrap')).stone_rates || []).map((row) => ({ ...row, rate_per_unit: row.rate })), staleTime: 15000, refetchOnWindowFocus: true }) }
