import { useQuery } from '@tanstack/react-query'
import { getBreakup } from '@/lib/pricing'

export function usePriceBreakup(variantId) {
  return useQuery({
    queryKey: ['price-breakup', variantId],
    queryFn: () => getBreakup(variantId),
    enabled: !!variantId,
    staleTime: 1000 * 10,
    refetchOnWindowFocus: true,
  })
}
