import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toCertificatePayload } from '@/lib/certificatePayload'
import { uploadCertificateFile } from '@/lib/storage'

export function useAdminCertificates(productId, query = {}) {
  const page = query.page ?? 1
  const limit = query.limit ?? 25
  return useQuery({
    queryKey: ['admin-certificates', productId, page, limit],
    enabled: !!productId,
    queryFn: () => api.getWithMeta('/admin/catalog/certificates', {
      product_id: productId,
      page,
      limit,
    }),
  })
}

export function useAdminCertificateMutations() {
  const qc = useQueryClient()
  const invalidate = (productId) => {
    qc.invalidateQueries({ queryKey: ['admin-certificates', productId] })
    qc.invalidateQueries({ queryKey: ['certificates'] })
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['product'] })
    qc.invalidateQueries({ queryKey: ['admin-products'] })
    qc.invalidateQueries({ queryKey: ['admin-product', productId] })
  }
  const create = useMutation({
    mutationFn: async ({ productId, variantId, file, ...body }) => {
      const fileUrl = file ? await uploadCertificateFile(file) : body.file_url || null
      const payload = toCertificatePayload({
        ...body,
        product_id: productId,
        variant_id: variantId || null,
        file_url: fileUrl,
      })
      return api.post('/admin/catalog/certificates', payload)
    },
    onSuccess: (_, vars) => invalidate(vars.productId),
  })
  const update = useMutation({
    mutationFn: async ({ id, productId, file, ...body }) => {
      const patch = { ...body }
      if (file) patch.file_url = await uploadCertificateFile(file)
      return api.patch(
        `/admin/catalog/certificates/${id}`,
        toCertificatePayload({ ...patch, product_id: productId }, { partial: true }),
      )
    },
    onSuccess: (_, vars) => invalidate(vars.productId),
  })
  const remove = useMutation({
    mutationFn: ({ id }) => api.delete(`/admin/catalog/certificates/${id}`),
    onSuccess: (_, vars) => invalidate(vars.productId),
  })
  return { create, update, remove }
}
