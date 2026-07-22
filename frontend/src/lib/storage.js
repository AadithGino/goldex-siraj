import { api } from '@/lib/api'
export const uploadProductImage = async (file) => (await api.upload('/admin/media/product', file)).url
export const uploadCertificateFile = async (file) => (await api.upload('/admin/media/certificate', file)).url
export const uploadBannerImage = async (file) => (await api.upload('/admin/media/banner', file)).url
export const uploadStoreLogo = async (file) => (await api.upload('/admin/media/banner', file)).url
export const uploadReturnProof = async (file) => (await api.upload('/customer/media/return-proof', file)).key
export const uploadCategoryImage = async (file) => (await api.upload('/admin/media/banner', file)).url
export function slugify(text) { return String(text || '').toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '') }
