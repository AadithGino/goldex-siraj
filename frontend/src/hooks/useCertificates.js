import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** Documented customer certificate page size (≤ backend maxLimit 100). */
export const CUSTOMER_CERTIFICATE_PAGE_SIZE = 10

/**
 * Public applicable certificates for a product (optional variant scope).
 * Server filters — do not client-filter a capped page.
 * Query keys include productId, variantId, page, limit.
 */
export function useCertificates(productId, variantId, { page = 1, limit = CUSTOMER_CERTIFICATE_PAGE_SIZE } = {}) {
  return useQuery({
    queryKey: ['certificates', productId, variantId || null, page, limit],
    enabled: !!productId,
    queryFn: () => api.getWithMeta('/customer/catalog/certificates', {
      product_id: productId,
      ...(variantId ? { applicable_variant_id: variantId } : {}),
      page,
      limit,
    }),
  })
}
