import { api } from '@/lib/api'
import { isStorefrontVariantValid } from '@/lib/storefrontVariants'
import { fuzzyFilter } from '@/lib/fuzzySearch'

const list = (resource, query = {}) => api.get(`/customer/catalog/${resource}`, { limit: 100, ...query })
export const getCategories = () => list('categories')
export const getBrands = ({ includeInactive = false } = {}) => includeInactive ? api.get('/admin/catalog/brands', { limit: 100 }) : list('brands')
export const getProductVariants = (_productIds, { includeInactive = false } = {}) => (includeInactive ? api.get('/admin/catalog/variants', { limit: 100 }) : list('variants')).then((rows) => rows.sort((a, b) => Number(a.display_order ?? a.weight_grams ?? 0) - Number(b.display_order ?? b.weight_grams ?? 0)))
export const getProductImages = () => list('images').then((rows) => rows.map((image) => ({ ...image, url: image.image_url })))

function normalizeProductDetail(product) {
  if (!product) return null
  const variants = (product.product_variants || product.variants || []).map((variant) => ({
    ...variant,
    variant_label: variant.label || variant.variant_label,
    size: variant.size_label || variant.ring_size || variant.bangle_size || variant.chain_length_inch,
    product_stones: variant.product_stones || [],
  }))
  const images = (product.product_images || product.images || []).map((image) => ({
    ...image,
    url: image.image_url || image.url,
  }))
  return {
    ...product,
    occasions: product.occasions || product.occasion || [],
    variants,
    product_variants: variants,
    images,
    product_images: images,
    category: product.category || product.categories || null,
    categories: product.categories || product.category || null,
    brands: product.brands || product.brand || null,
    certificates: product.certificates || [],
    primary_image: product.primary_image || images.find((image) => image.is_primary)?.image_url || images[0]?.image_url || null,
    has_certificate: product.has_certificate ?? (product.certificates || []).length > 0,
  }
}

/**
 * Server-side hydrated product listing. Returns { items, meta } when withMeta is true,
 * otherwise a plain array for backward-compatible storefront callers.
 */
export async function getProducts(options = {}) {
  const admin = options.includeInactive
  const base = admin ? '/admin/catalog' : '/customer/catalog'
  const page = options.page || 1
  const limit = options.limit || 50
  const query = {
    page,
    limit,
    hydrate: '1',
    search: options.search || undefined,
    category_id: options.categoryId || undefined,
    brand_id: options.brandId || undefined,
    is_featured: options.featured ? true : undefined,
  }
  const { data, meta } = await api.getWithMeta(`${base}/products`, query)
  let mapped = (data || []).map(normalizeProductDetail)
  if (!admin) {
    mapped = mapped
      .map((product) => ({
        ...product,
        variants: (product.variants || []).filter(isStorefrontVariantValid),
        product_variants: (product.product_variants || []).filter(isStorefrontVariantValid),
      }))
      .filter((product) => product.product_variants.length)
  }
  if (options.occasion) mapped = mapped.filter((product) => product.occasions?.includes(options.occasion))
  if (options.search && !query.search) mapped = fuzzyFilter(mapped, options.search, ['name', 'name_ar', 'short_description', 'description', 'slug', 'metal_color', 'brands.name'])
  if (options.withMeta) return { items: mapped, meta: meta || { page, limit, total: mapped.length, pages: 1 } }
  return mapped
}

/** Direct product detail by id or slug — avoids downloading the full catalog join. */
export async function getProductById(idOrSlug, options = {}) {
  if (!idOrSlug) return null
  const admin = options.includeInactive
  const base = admin ? '/admin/catalog' : '/customer/catalog'
  try {
    const product = await api.get(`${base}/products/${encodeURIComponent(idOrSlug)}`)
    const normalized = normalizeProductDetail(product)
    if (!admin && normalized) {
      normalized.variants = (normalized.variants || []).filter(isStorefrontVariantValid)
      normalized.product_variants = (normalized.product_variants || []).filter(isStorefrontVariantValid)
      if (!normalized.product_variants.length) return null
    }
    return normalized
  } catch {
    return null
  }
}

export const getBanners = () => list('banners')
export const getCurrentGoldRates = async () => (await api.get('/customer/catalog/bootstrap')).gold_rates || []
