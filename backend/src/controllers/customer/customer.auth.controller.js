import { Customer } from '../../models/auth.models.js'
import * as authService from '../../services/auth.service.js'
import { ok } from '../../utils/apiResponse.js'
import { AppError } from '../../utils/AppError.js'
import { serialize } from '../../utils/serialize.js'
import {
  clearCustomerSessionCookies,
  readCustomerRefreshToken,
  setCustomerSessionCookies,
} from '../../utils/sessionCookies.js'

const requestMeta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip })

export async function sendOtp(req, res) { await ok(res, await authService.sendOtp(req.validated.body.phone), 202) }
export async function verifyOtp(req, res) {
  const customer = await authService.verifyOtp(req.validated.body.phone, req.validated.body.code)
  const tokens = await authService.issueSession(customer, 'customer', requestMeta(req))
  setCustomerSessionCookies(res, tokens)
  await ok(res, { user: serialize(customer), access_token: tokens.accessToken }, 200)
}
export async function refresh(req, res) {
  const result = await authService.rotateSession(readCustomerRefreshToken(req), requestMeta(req))
  if (result.type !== 'customer') throw new AppError(403, 'WRONG_PORTAL', 'Use the staff portal')
  setCustomerSessionCookies(res, result.tokens)
  await ok(res, { user: serialize(result.actor), access_token: result.tokens.accessToken })
}
export async function logout(req, res) {
  await authService.revokeSession(readCustomerRefreshToken(req))
  clearCustomerSessionCookies(res)
  res.status(204).end()
}
export async function me(req, res) {
  const customer = await Customer.findOne({ _id: req.auth.sub, isActive: true })
  if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer account not found')
  await ok(res, serialize(customer))
}
export async function updateProfile(req, res) {
  const allowed = (({ full_name, email, avatar_url }) => ({ fullName: full_name, email, avatarUrl: avatar_url }))(req.validated.body)
  const customer = await Customer.findByIdAndUpdate(req.auth.sub, { $set: allowed }, { new: true, runValidators: true })
  await ok(res, serialize(customer))
}
