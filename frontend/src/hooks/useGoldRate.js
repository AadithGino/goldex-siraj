import { useQuery } from '@tanstack/react-query'
import { getCurrentGoldRates } from '@/lib/catalogApi'

export function useGoldRate() {
  return useQuery({
    queryKey: ['gold-rates'],
    queryFn: getCurrentGoldRates,
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 60,
    refetchOnWindowFocus: true,
  })
}
