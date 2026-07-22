import { useQueries } from '@tanstack/react-query'
import { getBreakup } from '@/lib/pricing'
import { getDefaultVariant } from '@/hooks/useProducts'

export function useProductPriceMap(products) {
  const entries =
    products
      ?.map((product) => {
        const variant = getDefaultVariant(product)
        return variant ? { productId: product.id, variantId: variant.id } : null
      })
      .filter(Boolean) ?? []

  const queries = useQueries({
    queries: entries.map(({ variantId }) => ({
      queryKey: ['price-breakup', variantId],
      queryFn: () => getBreakup(variantId),
      staleTime: 1000 * 10,
      refetchOnWindowFocus: true,
    })),
  })

  const priceMap = {}
  entries.forEach(({ variantId }, index) => {
    const total = queries[index]?.data?.total
    if (total != null) priceMap[variantId] = Number(total)
  })

  return {
    priceMap,
    isLoadingPrices: queries.some((q) => q.isLoading),
  }
}
