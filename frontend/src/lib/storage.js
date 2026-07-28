import { api } from '@/lib/api'

/** Prefer stable storage_url for DB; signed `url` is only for immediate preview. */
async function persistableUrl(path, file) {
  const res = await api.upload(path, file)
  return res.storage_url || res.url
}

export const uploadProductImage = (file) => persistableUrl('/admin/media/product', file)
export const uploadCertificateFile = (file) => persistableUrl('/admin/media/certificate', file)
export const uploadBannerImage = (file) => persistableUrl('/admin/media/banner', file)
export const uploadStoreLogo = (file) => persistableUrl('/admin/media/banner', file)
export const uploadReturnProof = async (file) => (await api.upload('/customer/media/return-proof', file)).key
export const uploadCategoryImage = (file) => persistableUrl('/admin/media/category', file)
export function slugify(text) {
  return String(text || '').toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
}
