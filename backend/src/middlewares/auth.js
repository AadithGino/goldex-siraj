import jwt from 'jsonwebtoken'
import { config } from '../config/env.js'
import { Customer, Staff } from '../models/auth.models.js'
import { AppError } from '../utils/AppError.js'
import {
  readCustomerAccessToken,
  readLegacyAccessTokenIfType,
  readStaffAccessToken,
} from '../utils/sessionCookies.js'

function verifyAccess(token) {
  return jwt.verify(token, config.jwt.accessSecret)
}

async function loadCustomerActor(payload) {
  if (payload?.type !== 'customer') {
    throw new AppError(403, 'FORBIDDEN', 'This account cannot access the resource')
  }
  const customer = await Customer.findById(payload.sub).select('+tokenVersion')
  if (!customer || !customer.isActive) {
    throw new AppError(401, 'ACCOUNT_DISABLED', 'Account is unavailable')
  }
  if ((customer.tokenVersion || 0) !== (payload.tokenVersion || 0)) {
    throw new AppError(401, 'INVALID_TOKEN', 'Session is invalid or expired')
  }
  return payload
}

async function loadStaffActor(payload) {
  if (payload?.type !== 'staff') {
    throw new AppError(403, 'FORBIDDEN', 'This account cannot access the resource')
  }
  const staff = await Staff.findById(payload.sub).select('+tokenVersion')
  if (!staff || !staff.isActive) {
    throw new AppError(401, 'ACCOUNT_DISABLED', 'Account is unavailable')
  }
  if ((staff.tokenVersion || 0) !== (payload.tokenVersion || 0)) {
    throw new AppError(401, 'INVALID_TOKEN', 'Session is invalid or expired')
  }
  return { ...payload, role: staff.role }
}

export async function authenticateCustomer(req, _res, next) {
  try {
    let token = readCustomerAccessToken(req)
    if (!token) {
      token = readLegacyAccessTokenIfType(req, 'customer', verifyAccess)
    }
    if (!token) return next(new AppError(401, 'AUTH_REQUIRED', 'Authentication required'))
    const payload = verifyAccess(token)
    req.auth = await loadCustomerActor(payload)
    return next()
  } catch (error) {
    if (error instanceof AppError) return next(error)
    return next(new AppError(401, 'INVALID_TOKEN', 'Session is invalid or expired'))
  }
}

export async function authenticateStaff(req, _res, next) {
  try {
    let token = readStaffAccessToken(req)
    if (!token) {
      token = readLegacyAccessTokenIfType(req, 'staff', verifyAccess)
    }
    if (!token) return next(new AppError(401, 'AUTH_REQUIRED', 'Authentication required'))
    const payload = verifyAccess(token)
    req.auth = await loadStaffActor(payload)
    return next()
  } catch (error) {
    if (error instanceof AppError) return next(error)
    return next(new AppError(401, 'INVALID_TOKEN', 'Session is invalid or expired'))
  }
}

/** @deprecated Prefer authenticateCustomer / authenticateStaff — kept for rare shared probes. */
export function authenticate(req, _res, next) {
  const bearer = req.get('authorization')?.replace(/^Bearer\s+/i, '')
  const token = req.cookies?.customerAccessToken
    || req.cookies?.staffAccessToken
    || req.cookies?.accessToken
    || bearer
  if (!token) return next(new AppError(401, 'AUTH_REQUIRED', 'Authentication required'))
  try {
    req.auth = verifyAccess(token)
    return next()
  } catch {
    return next(new AppError(401, 'INVALID_TOKEN', 'Session is invalid or expired'))
  }
}

export const requireActor = (...types) => (req, _res, next) => {
  if (!types.includes(req.auth?.type)) return next(new AppError(403, 'FORBIDDEN', 'This account cannot access the resource'))
  next()
}

const rank = { staff: 1, manager: 2, owner: 3 }
export const authorizeStaffRoles = (...roles) => (req, _res, next) => {
  const required = Math.min(...roles.map((role) => rank[role]))
  if (!rank[req.auth?.role] || rank[req.auth.role] < required) {
    return next(new AppError(403, 'INSUFFICIENT_ROLE', 'Insufficient staff permission'))
  }
  next()
}

/** @deprecated Use authorizeStaffRoles */
export const requireStaffRole = authorizeStaffRoles
