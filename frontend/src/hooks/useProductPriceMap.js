import { getDefaultVariant } from '@/hooks/useProducts'

export function useProductPriceMap(products) {
  const priceMap = {}
  const list = Array.isArray(products) ? products : []
  list.forEach((product) => {
    const variants = product?.product_variants || product?.variants || []
    variants.forEach((variant) => {
      const total = variant?.live_price_total
      if (variant?.id && total != null) priceMap[variant.id] = Number(total)
    })
    const fallback = getDefaultVariant(product)
    if (fallback?.id && priceMap[fallback.id] == null) {
      const total = fallback?.live_price_total
      if (total != null) priceMap[fallback.id] = Number(total)
    }
  })

  return {
    priceMap,
    isLoadingPrices: false,
  }
}
