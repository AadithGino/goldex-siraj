import { createHash, randomBytes, randomInt } from 'node:crypto'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { canExposeTestOtp, config } from '../config/env.js'
import { logger } from '../config/logger.js'
import { Customer, OtpCode, RefreshSession, Staff } from '../models/auth.models.js'
import { AppError } from '../utils/AppError.js'

const phonePattern = /^\+[1-9]\d{7,14}$/
const hashToken = (token) => createHash('sha256').update(token).digest('hex')

function ttlToMs(ttl) {
  const match = /^(\d+)([smhd])$/.exec(ttl)
  if (!match) throw new Error(`Unsupported token TTL: ${ttl}`)
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]]
  return Number(match[1]) * unit
}

export function normalizePhone(input) {
  const phone = String(input || '').replace(/[\s()-]/g, '')
  if (!phonePattern.test(phone)) throw new AppError(422, 'INVALID_PHONE', 'Phone must be in E.164 format, for example +971501234567')
  return phone
}

async function deliverOtp(phone, code) {
  if (config.otp.provider === 'console') {
    logger.info({ phone }, 'Development OTP delivered via console provider')
    return
  }
  const response = await fetch(config.otp.providerUrl, { method: 'POST', headers: { authorization: `Bearer ${config.otp.apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ phone, code }) })
  if (!response.ok) throw new AppError(502, 'OTP_DELIVERY_FAILED', 'Could not deliver OTP')
}

function isDuplicateKey(error) {
  return error?.code === 11000 || error?.cause?.code === 11000
}

/**
 * Create at most one active OTP per phone. Concurrent sends serialize via unique activeChallengeKey.
 * Rate limit is insert-then-count (atomic under concurrency): over-limit docs are deleted.
 */
export async function sendOtp(phoneInput) {
  const phone = normalizePhone(phoneInput)

  const code = String(randomInt(100000, 1000000))
  const codeHash = await argon2.hash(code)
  const expiresAt = new Date(Date.now() + config.otp.ttlSeconds * 1000)
  const challengeKey = `${phone}:login`
  const doc = {
    phone,
    codeHash,
    maxAttempts: config.otp.maxAttempts,
    expiresAt,
    consumedAt: null,
    activeChallengeKey: challengeKey,
    attempts: 0,
  }

  // Concurrent sends race on the partial unique activeChallengeKey index.
  // Retry: clear any active challenge for this phone, then insert until we win
  // (or surface a non-duplicate error). Do not rely on in-memory locks.
  const maxInsertAttempts = 8
  let created = null
  for (let attempt = 0; attempt < maxInsertAttempts; attempt += 1) {
    await OtpCode.updateMany(
      { phone, $or: [{ consumedAt: null }, { activeChallengeKey: challengeKey }] },
      { $set: { consumedAt: new Date(), activeChallengeKey: null } },
    )
    try {
      created = await OtpCode.create(doc)
      break
    } catch (error) {
      if (!isDuplicateKey(error)) throw error
    }
  }
  if (!created) {
    throw new AppError(503, 'OTP_CONTENTION', 'Could not create OTP challenge; please retry')
  }

  // Insert-then-count rate limit (avoids racy countDocuments-before-insert).
  const recent = await OtpCode.countDocuments({
    phone,
    createdAt: { $gte: new Date(Date.now() - 15 * 60_000) },
  })
  if (recent > 5) {
    await OtpCode.deleteOne({ _id: created._id })
    throw new AppError(429, 'OTP_LIMIT', 'Too many OTP requests; try again later')
  }

  try {
    await deliverOtp(phone, code)
  } catch (error) {
    // Only invalidate the document we just created — never clear another phone's active challenge.
    await OtpCode.updateOne(
      { _id: created._id },
      { $set: { consumedAt: new Date(), activeChallengeKey: null } },
    )
    throw error
  }

  // Re-verify this doc is still the active challenge before returning a code.
  const stillActive = await OtpCode.findOne({
    _id: created._id,
    consumedAt: null,
    activeChallengeKey: challengeKey,
  })
  if (!stillActive) {
    throw new AppError(503, 'OTP_CONTENTION', 'OTP challenge was superseded; please retry')
  }

  const payload = { expires_in: config.otp.ttlSeconds }
  if (canExposeTestOtp()) payload.test_otp = code
  return payload
}

/**
 * Consume an OTP exactly once. Concurrent verifies: one success, others INVALID_OTP.
 */
export async function verifyOtp(phoneInput, code) {
  const phone = normalizePhone(phoneInput)
  const otp = await OtpCode.findOne({
    phone,
    consumedAt: null,
    activeChallengeKey: { $ne: null },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 }).select('+codeHash')

  if (!otp || otp.attempts >= otp.maxAttempts) {
    throw new AppError(401, 'INVALID_OTP', 'OTP is invalid or expired')
  }

  const valid = await argon2.verify(otp.codeHash, String(code))
  if (!valid) {
    const bumped = await OtpCode.findOneAndUpdate(
      {
        _id: otp.id,
        consumedAt: null,
        attempts: { $lt: otp.maxAttempts },
      },
      { $inc: { attempts: 1 } },
      { new: true },
    )
    if (!bumped || bumped.attempts >= bumped.maxAttempts) {
      await OtpCode.updateOne(
        { _id: otp.id, consumedAt: null },
        { $set: { consumedAt: new Date(), activeChallengeKey: null } },
      )
    }
    throw new AppError(401, 'INVALID_OTP', 'OTP is invalid or expired')
  }

  const consumed = await OtpCode.findOneAndUpdate(
    {
      _id: otp.id,
      consumedAt: null,
      activeChallengeKey: { $ne: null },
      expiresAt: { $gt: new Date() },
      attempts: { $lt: otp.maxAttempts },
    },
    { $set: { consumedAt: new Date(), activeChallengeKey: null } },
    { new: true },
  )
  if (!consumed) throw new AppError(401, 'INVALID_OTP', 'OTP is invalid or expired')

  const customer = await Customer.findOneAndUpdate(
    { phone },
    { $setOnInsert: { phone, authProvider: 'otp' }, $set: { isActive: true } },
    { upsert: true, new: true },
  )
  return customer
}

export async function staffLogin(email, password) {
  const staff = await Staff.findOne({ email: String(email).toLowerCase(), isActive: true }).select('+passwordHash +tokenVersion')
  if (!staff || !(await argon2.verify(staff.passwordHash, password))) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
  staff.lastLoginAt = new Date()
  await staff.save()
  return staff
}

export async function issueSession(actor, type, request = {}, { session = null } = {}) {
  const refreshToken = randomBytes(48).toString('base64url')
  const role = type === 'staff' ? actor.role : undefined
  const tokenVersion = actor.tokenVersion || 0
  const accessToken = jwt.sign(
    { sub: String(actor.id), type, ...(role ? { role } : {}), tokenVersion },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl },
  )
  const docs = [{
    actorId: actor.id,
    actorType: type,
    tokenHash: hashToken(refreshToken),
    tokenVersion,
    expiresAt: new Date(Date.now() + ttlToMs(config.jwt.refreshTtl)),
    userAgent: request.userAgent,
    ip: request.ip,
  }]
  if (session) await RefreshSession.create(docs, { session })
  else await RefreshSession.create(docs[0])
  return { accessToken, refreshToken, accessExpiresIn: ttlToMs(config.jwt.accessTtl) / 1000 }
}

/**
 * Consume a refresh token, then CAS actor generation and issue a replacement.
 * Consume commits before CAS so logout-all / password-reset can win the race without deadlock.
 * Failure after consume does not leave a valid replacement session.
 */
export async function rotateSession(refreshToken, request = {}, { afterConsumeHook } = {}) {
  if (!refreshToken) throw new AppError(401, 'REFRESH_REQUIRED', 'Refresh session is missing')
  const tokenHash = hashToken(refreshToken)

  // Phase 1 — consume exactly once (short transaction).
  const consumeSession = await mongoose.startSession()
  let consumed
  try {
    await consumeSession.withTransaction(async () => {
      consumed = await RefreshSession.findOneAndUpdate(
        { tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } },
        { $set: { revokedAt: new Date() } },
        { new: true, session: consumeSession },
      ).select('+tokenHash')
      if (!consumed) throw new AppError(401, 'INVALID_REFRESH', 'Refresh session is invalid or expired')
    })
  } finally {
    await consumeSession.endSession()
  }

  const Model = consumed.actorType === 'staff' ? Staff : Customer
  const actor = await Model.findOne({ _id: consumed.actorId, isActive: true }).select('+tokenVersion')
  if (!actor) throw new AppError(401, 'ACCOUNT_DISABLED', 'Account is unavailable')

  const sessionVersion = consumed.tokenVersion == null ? 0 : Number(consumed.tokenVersion)
  const actorVersion = actor.tokenVersion || 0
  if (actorVersion !== sessionVersion) {
    throw new AppError(401, 'INVALID_REFRESH', 'Refresh session is invalid or expired')
  }

  if (typeof afterConsumeHook === 'function') {
    await afterConsumeHook({ actor, consumed })
  }

  // Phase 2 — generation CAS + replacement issuance in one transaction.
  const issueSessionMongo = await mongoose.startSession()
  try {
    let result
    await issueSessionMongo.withTransaction(async () => {
      const stillCurrent = await Model.findOneAndUpdate(
        { _id: actor.id, isActive: true, tokenVersion: sessionVersion },
        { $inc: { tokenVersion: 0 } },
        { new: true, session: issueSessionMongo },
      ).select('+tokenVersion')
      if (!stillCurrent) {
        throw new AppError(401, 'INVALID_REFRESH', 'Refresh session is invalid or expired')
      }
      const tokens = await issueSession(stillCurrent, consumed.actorType, request, { session: issueSessionMongo })
      result = { actor: stillCurrent, type: consumed.actorType, tokens }
    })
    return result
  } finally {
    await issueSessionMongo.endSession()
  }
}

export async function revokeSession(refreshToken) {
  if (refreshToken) await RefreshSession.updateOne({ tokenHash: hashToken(refreshToken), revokedAt: null }, { $set: { revokedAt: new Date() } })
}

export async function revokeAllSessions(actorId, actorType, { session = null } = {}) {
  if (!actorId || !actorType) return
  const filter = { actorId, actorType, revokedAt: null }
  const update = { $set: { revokedAt: new Date() } }
  if (session) await RefreshSession.updateMany(filter, update, { session })
  else await RefreshSession.updateMany(filter, update)
}

/** Bump tokenVersion and revoke all refresh sessions so existing JWTs fail immediately. */
export async function invalidateActorSessions(actorId, actorType) {
  const Model = actorType === 'staff' ? Staff : Customer
  const mongoSession = await mongoose.startSession()
  try {
    await mongoSession.withTransaction(async () => {
      await Model.updateOne({ _id: actorId }, { $inc: { tokenVersion: 1 } }, { session: mongoSession })
      await revokeAllSessions(actorId, actorType, { session: mongoSession })
    })
  } finally {
    await mongoSession.endSession()
  }
}

export async function changeStaffPassword(staffId, currentPassword, newPassword) {
  const staff = await Staff.findById(staffId).select('+passwordHash +tokenVersion')
  if (!staff || !staff.isActive) throw new AppError(404, 'STAFF_NOT_FOUND', 'Staff account not found')
  if (!(await argon2.verify(staff.passwordHash, currentPassword))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect')
  }
  if (currentPassword === newPassword) {
    throw new AppError(422, 'PASSWORD_UNCHANGED', 'New password must differ from the current password')
  }
  const mongoSession = await mongoose.startSession()
  try {
    await mongoSession.withTransaction(async () => {
      staff.passwordHash = await hashPassword(newPassword)
      staff.tokenVersion = (staff.tokenVersion || 0) + 1
      await staff.save({ session: mongoSession })
      await revokeAllSessions(staff.id, 'staff', { session: mongoSession })
    })
  } finally {
    await mongoSession.endSession()
  }
  return staff
}

export const hashPassword = (password) => argon2.hash(password, { type: argon2.argon2id })
