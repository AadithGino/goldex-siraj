import { api } from '@/lib/api'

export const sendOtp = (phone) => api.post('/customer/auth/otp/send', { phone })
export const verifyOtp = (phone, code) => api.post('/customer/auth/otp/verify', { phone, code: String(code) })
export const placeOrder = (payload) => api.post('/customer/orders', {
  address_id: payload.p_address_id,
  coupon_code: payload.p_coupon_code,
  payment_method: payload.p_payment_method,
  wallet_use: payload.p_wallet_use,
  idempotency_key: payload.p_idempotency_key,
  is_gift: payload.p_is_gift,
  gift_note: payload.p_gift_note,
})
export const getWalletBalance = async () => Number((await api.get('/customer/wallet'))?.balance || 0)
export const validateCoupon = (code, orderTotal) => api.post('/customer/coupons/validate', { code, order_total: orderTotal })
export const updateCustomerProfile = ({ fullName, email, avatarUrl = null }) => api.patch('/customer/auth/me', { full_name: fullName || null, email: email || null, avatar_url: avatarUrl })
export const uploadReturnProof = (file) => api.upload('/customer/media/return-proof', file)

export async function createPaymentSession() { throw new Error('Online payment gateway is disabled') }
export async function createCcavenuePayment() { throw new Error('Online payment gateway is disabled') }
export async function createSchemePaymentSession() { throw new Error('Online scheme payments are disabled; contact the store to arrange payment') }
