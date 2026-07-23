import { Staff } from '../../models/auth.models.js'
import * as authService from '../../services/auth.service.js'
import { ok } from '../../utils/apiResponse.js'
import { AppError } from '../../utils/AppError.js'
import { serialize } from '../../utils/serialize.js'
import {
  clearStaffSessionCookies,
  readStaffRefreshToken,
  setStaffSessionCookies,
} from '../../utils/sessionCookies.js'

export async function login(req, res) {
  const staff = await authService.staffLogin(req.validated.body.email, req.validated.body.password)
  const tokens = await authService.issueSession(staff, 'staff', { userAgent: req.get('user-agent'), ip: req.ip })
  setStaffSessionCookies(res, tokens)
  await ok(res, { user: serialize(staff), access_token: tokens.accessToken })
}
export async function refresh(req, res) {
  const result = await authService.rotateSession(readStaffRefreshToken(req), { userAgent: req.get('user-agent'), ip: req.ip })
  if (result.type !== 'staff') throw new AppError(403, 'WRONG_PORTAL', 'Use the customer portal')
  setStaffSessionCookies(res, result.tokens)
  await ok(res, { user: serialize(result.actor), access_token: result.tokens.accessToken })
}
export async function me(req, res) {
  const staff = await Staff.findOne({ _id: req.auth.sub, isActive: true })
  if (!staff) throw new AppError(404, 'STAFF_NOT_FOUND', 'Staff account not found')
  await ok(res, serialize(staff))
}
export async function logout(req, res) {
  await authService.revokeSession(readStaffRefreshToken(req))
  clearStaffSessionCookies(res)
  res.status(204).end()
}
export async function logoutAll(req, res) {
  await authService.invalidateActorSessions(req.auth.sub, 'staff')
  clearStaffSessionCookies(res)
  res.status(204).end()
}
export async function changePassword(req, res) {
  const { current_password: currentPassword, new_password: newPassword } = req.validated.body
  await authService.changeStaffPassword(req.auth.sub, currentPassword, newPassword)
  clearStaffSessionCookies(res)
  res.status(204).end()
}
