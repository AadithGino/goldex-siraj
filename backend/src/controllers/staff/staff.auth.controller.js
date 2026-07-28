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

function sessionPayload(user, tokens) {
  return {
    user: serialize(user),
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  }
}

function refreshTokenFrom(req) {
  return req.validated?.body?.refresh_token
    || req.validated?.body?.refreshToken
    || req.body?.refresh_token
    || req.body?.refreshToken
    || readStaffRefreshToken(req)
    || null
}

export async function login(req, res) {
  const staff = await authService.staffLogin(req.validated.body.email, req.validated.body.password)
  const tokens = await authService.issueSession(staff, 'staff', { userAgent: req.get('user-agent'), ip: req.ip })
  setStaffSessionCookies(res, tokens)
  await ok(res, sessionPayload(staff, tokens))
}
export async function refresh(req, res) {
  const result = await authService.rotateSession(refreshTokenFrom(req), { userAgent: req.get('user-agent'), ip: req.ip })
  if (result.type !== 'staff') throw new AppError(403, 'WRONG_PORTAL', 'Use the customer portal')
  setStaffSessionCookies(res, result.tokens)
  await ok(res, sessionPayload(result.actor, result.tokens))
}
export async function me(req, res) {
  const staff = await Staff.findOne({ _id: req.auth.sub, isActive: true })
  if (!staff) throw new AppError(404, 'STAFF_NOT_FOUND', 'Staff account not found')
  await ok(res, serialize(staff))
}
export async function logout(req, res) {
  await authService.revokeSession(refreshTokenFrom(req))
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
