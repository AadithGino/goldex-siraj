import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { uploadProductImage } from '@/lib/storage'
import { toProductPayload, pickProductDbPayload, toVariantPayload, toProductStonePayload, pickVariantDbPayload } from '@/lib/productDefaults'
import { parseOptionalNumber } from '@/lib/numberParse'
import { getProducts, getProductById } from '@/lib/catalogApi'

const normalizeSku = (sku) => String(sku || '').trim()
function newVariantIdempotencyKey(prefix, seed) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${seed || 'x'}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
function buildVariantLabel(variant = {}) {
  const current = String(variant.label || variant.variant_label || '').trim()
  if (current) return current
  const weight = Number(variant.effective_weight ?? variant.weight_grams)
  return variant.purity && weight > 0 ? `${String(variant.purity).toUpperCase()} / ${weight}g` : ''
}
function validateVariant(variant = {}) {
  if (variant.is_active === false || Number(variant.price_override ?? variant.fixed_price) > 0) return
  if (!variant.purity) throw new Error('Purity is required for active variants without fixed price')
  if (!(Number(variant.weight_grams) > 0)) throw new Error('Metal weight must be greater than 0 for active live-priced variants')
}

function buildCompleteVariantBody({ product_stones: stones, stock_qty, ...variant }) {
  validateVariant(variant)
  const base = pickVariantDbPayload(toVariantPayload({
    ...variant,
    label: buildVariantLabel(variant),
    sku: normalizeSku(variant.sku),
    stock_qty,
  }))
  const parsedStock = stock_qty === undefined
    ? undefined
    : parseOptionalNumber(stock_qty, 'stock_qty', { integer: true, min: 0 })
  return {
    ...base,
    product_id: variant.product_id,
    stock_qty: parsedStock === null ? undefined : (parsedStock ?? base.stock_qty),
    product_stones: (stones || [])
      .filter((item) => item.label?.trim() || item.stone_type?.trim())
      .map((stone, index) => toProductStonePayload(stone, index)),
  }
}

export function useAdminProducts({ page = 1, limit = 50, search } = {}) {
  return useQuery({
    queryKey: ['admin-products', { page, limit, search }],
    queryFn: () => getProducts({ includeInactive: true, page, limit, search, withMeta: true }),
  })
}
export function useAdminProduct(productId) {
  return useQuery({
    queryKey: ['admin-product', productId],
    queryFn: () => getProductById(productId, { includeInactive: true }),
    enabled: !!productId,
  })
}

export function useAdminProductMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-products'] })
    qc.invalidateQueries({ queryKey: ['products'] })
  }
  const refetch = (id) => qc.refetchQueries({ queryKey: ['admin-product', id] })

  const createProduct = useMutation({
    mutationFn: (product) => api.post('/admin/catalog/products', pickProductDbPayload(toProductPayload(product))),
    onSuccess: (data) => {
      invalidate()
      qc.setQueryData(['admin-product', data.id], { ...data, product_variants: [], product_images: [] })
    },
  })
  const updateProduct = useMutation({
    mutationFn: ({ id, ...product }) => api.patch(`/admin/catalog/products/${id}`, pickProductDbPayload(toProductPayload(product))),
    onSuccess: (_, vars) => { invalidate(); refetch(vars.id) },
  })
  const deleteProduct = useMutation({
    mutationFn: (id) => api.delete(`/admin/catalog/products/${id}`),
    onSuccess: invalidate,
  })
  const duplicateProduct = useMutation({
    mutationFn: async (id) => {
      const source = await getProductById(id, { includeInactive: true })
      const product = await api.post('/admin/catalog/products', {
        ...pickProductDbPayload(toProductPayload(source)),
        name: `${source.name} (Copy)`,
        slug: `${source.slug}-copy-${Date.now().toString(36)}`,
        status: 'draft',
      })
      for (const sourceVariant of source.product_variants || []) {
        await api.post('/admin/catalog/variants/complete', {
          ...buildCompleteVariantBody({
            ...sourceVariant,
            product_id: product.id,
            sku: sourceVariant.sku ? `${sourceVariant.sku}-COPY-${Date.now().toString(36)}` : undefined,
            stock_qty: sourceVariant.stock_qty || 0,
            product_stones: sourceVariant.product_stones || [],
          }),
          idempotency_key: `dup-${product.id}-${sourceVariant.id || sourceVariant.sku}-${Date.now()}`,
        })
      }
      return product
    },
    onSuccess: invalidate,
  })
  const createVariant = useMutation({
    mutationFn: async (input) => {
      const body = buildCompleteVariantBody(input)
      const idempotency_key = input.idempotency_key
        || newVariantIdempotencyKey('variant-create', `${input.product_id}-${normalizeSku(input.sku)}`)
      return api.post('/admin/catalog/variants/complete', {
        ...body,
        idempotency_key,
        stock_idempotency_key: input.stock_idempotency_key || `${idempotency_key}:stock`,
      })
    },
    onSuccess: (_, vars) => {
      invalidate()
      refetch(vars.product_id)
      qc.invalidateQueries({ queryKey: ['price-breakup'] })
    },
  })
  const updateVariant = useMutation({
    mutationFn: async ({
      id,
      product_id: _productId,
      expected_stock_qty,
      expected_before,
      idempotency_key,
      stock_idempotency_key,
      ...input
    }) => {
      const body = buildCompleteVariantBody(input)
      const expected = expected_stock_qty ?? expected_before
      const patch = {
        ...body,
        idempotency_key: idempotency_key || newVariantIdempotencyKey('variant-update', id),
      }
      if (body.stock_qty !== undefined) {
        if (expected == null || expected === '') {
          throw new Error('expected_stock_qty is required when updating stock')
        }
        const expectedQty = Number(expected)
        if (!Number.isInteger(expectedQty) || expectedQty < 0) {
          throw new Error('expected_stock_qty must be a non-negative integer')
        }
        patch.expected_stock_qty = expectedQty
        patch.stock_idempotency_key = stock_idempotency_key || `${patch.idempotency_key}:stock`
      }
      return api.patch(`/admin/catalog/variants/${id}/complete`, patch)
    },
    onSuccess: (_, vars) => {
      invalidate()
      refetch(vars.product_id)
      qc.invalidateQueries({ queryKey: ['price-breakup'] })
    },
  })
  const deleteVariant = useMutation({
    mutationFn: ({ id }) => api.delete(`/admin/catalog/variants/${id}`),
    onSuccess: (_, vars) => { invalidate(); refetch(vars.product_id) },
  })
  const addImage = useMutation({
    mutationFn: async ({ productId, file, alt, isPrimary }) => {
      const url = await uploadProductImage(file)
      const image = await api.post('/admin/catalog/images', {
        product_id: productId,
        image_url: url,
        alt_text: alt || '',
        is_primary: isPrimary ?? false,
      })
      return { ...image, url: image.image_url, alt: image.alt_text }
    },
    onSuccess: (_, vars) => { invalidate(); refetch(vars.productId) },
  })
  const deleteImage = useMutation({
    mutationFn: ({ id }) => api.delete(`/admin/catalog/images/${id}`),
    onSuccess: (_, vars) => { invalidate(); refetch(vars.productId) },
  })
  const setPrimaryImage = useMutation({
    mutationFn: async ({ id }) => api.post(`/admin/catalog/images/${id}/set-primary`, {}),
    onSuccess: (_, vars) => { invalidate(); refetch(vars.productId) },
  })

  return {
    createProduct, updateProduct, deleteProduct, duplicateProduct,
    createVariant, updateVariant, deleteVariant, addImage, deleteImage, setPrimaryImage,
  }
}
