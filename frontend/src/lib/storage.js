import { api } from '@/lib/api'

/** Prefer stable storage_url for DB; signed `url` is only for immediate preview. */
async function persistableUrl(path, file) {
  const res = await api.upload(path, file)
  return res.storage_url || res.url
}

/**
 * Same pattern as product images: multipart → API → S3 (server-side PutObject).
 * Avoids browser→S3 CORS; bucket credentials stay on the API.
 */
async function uploadCustomerPrivateMedia(path, file) {
  const res = await api.upload(path, file)
  // `key` must stay the stable object key (not a signed GET URL).
  const key = res.key || res.storage_url
  if (!key) throw new Error('Upload did not return a storage key')
  return {
    key,
    previewUrl: res.url || res.storage_url,
    mime: res.mime,
  }
}

export const uploadProductImage = (file) => persistableUrl('/admin/media/product', file)
export const uploadCertificateFile = (file) => persistableUrl('/admin/media/certificate', file)
export const uploadBannerImage = (file) => persistableUrl('/admin/media/banner', file)
export const uploadStoreLogo = (file) => persistableUrl('/admin/media/banner', file)
export const uploadReturnProof = async (file) => (await api.upload('/customer/media/return-proof', file)).key

export async function uploadCustomJewelleryImage(file) {
  return uploadCustomerPrivateMedia('/customer/media/custom-jewellery', file)
}

export async function uploadSellJewelleryImage(file) {
  return uploadCustomerPrivateMedia('/customer/media/sell-jewellery', file)
}

export async function uploadSellInvoice(file) {
  return uploadCustomerPrivateMedia('/customer/media/sell-invoice', file)
}

export async function uploadSchemeIdProof(file, { portal = 'customer' } = {}) {
  const path = portal === 'admin' ? '/admin/media/scheme-id-proof' : '/customer/media/scheme-id-proof'
  const res = await api.upload(path, file)
  return res.storage_url || res.key || res.url
}
export const uploadCategoryImage = (file) => persistableUrl('/admin/media/category', file)
export function slugify(text) {
  return String(text || '').toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
}
