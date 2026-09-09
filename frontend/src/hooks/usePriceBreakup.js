import { useQuery } from '@tanstack/react-query'
import { getBreakup } from '@/lib/pricing'

export function usePriceBreakup(variantId, options = {}) {
  const enabled = options.enabled ?? true
  return useQuery({
    queryKey: ['price-breakup', variantId],
    queryFn: () => getBreakup(variantId),
    enabled: !!variantId && enabled,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
