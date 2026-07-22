import { useQuery } from '@tanstack/react-query'
import { getProducts, getProductById } from '@/lib/catalogApi'
import { isStorefrontVariantValid } from '@/lib/storefrontVariants'

export function useProducts(options = {}) {
  const { categoryId, brandId, featured, occasion, search } = options

  return useQuery({
    queryKey: ['products', { categoryId, brandId, featured, occasion, search }],
    queryFn: async () => {
      return getProducts({ categoryId, brandId, featured, occasion, search })
    },
  })
}

export function useProductBySlug(slug) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: () => getProductById(slug),
    enabled: !!slug,
  })
}

export function getDefaultVariant(product) {
  const variants = product?.product_variants || []
  if (!variants.length) return null

  const valid = variants.filter(isStorefrontVariantValid)
  const validInStock = valid.filter((variant) => Number(variant.stock_qty || 0) > 0)

  if (validInStock.length) return validInStock[0]
  if (valid.length) return valid[0]
  return variants[0]
}

/** Primary listing image + next gallery image for card hover (if any). */
export function getProductCardImages(product) {
  const sorted = [...(product?.product_images || [])].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return Number(b.is_primary) - Number(a.is_primary)
    return (a.display_order ?? 0) - (b.display_order ?? 0)
  })

  const primary =
    product?.primary_image ||
    sorted.find((img) => img.is_primary)?.url ||
    sorted[0]?.url ||
    null

  const hover = sorted.map((img) => img.url).find((url) => url && url !== primary) || null

  return { primary, hover }
}
