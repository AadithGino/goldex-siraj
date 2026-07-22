import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Customer, OtpCode, RefreshSession, Staff } from '../src/models/auth.models.js'
import * as authService from '../src/services/auth.service.js'

let mongoServer

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-auth-concurrency'))
  await OtpCode.syncIndexes()
  await RefreshSession.syncIndexes()
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})))
})

describe('OTP concurrency', () => {
  it('keeps at most one active challenge after concurrent sends', async () => {
    const phone = '+971501111001'
    const results = await Promise.allSettled([
      authService.sendOtp(phone),
      authService.sendOtp(phone),
      authService.sendOtp(phone),
    ])
    const fulfilled = results.filter((row) => row.status === 'fulfilled')
    const contended = results.filter((row) => row.status === 'rejected' && row.reason?.code === 'OTP_CONTENTION')
    expect(fulfilled.length).toBeGreaterThanOrEqual(1)
    expect(fulfilled.length + contended.length).toBe(results.length)
    const active = await OtpCode.countDocuments({ phone, consumedAt: null, activeChallengeKey: { $ne: null } })
    expect(active).toBe(1)
  })

  it('allows only one concurrent verification success for the same code', async () => {
    const phone = '+971501111002'
    process.env.SHOW_TEST_OTP = 'true'
    process.env.OTP_PROVIDER = 'console'
    process.env.NODE_ENV = 'test'
    const sent = await authService.sendOtp(phone)
    const code = sent.test_otp
    expect(code).toBeTruthy()

    const results = await Promise.allSettled([
      authService.verifyOtp(phone, code),
      authService.verifyOtp(phone, code),
      authService.verifyOtp(phone, code),
    ])
    const successes = results.filter((row) => row.status === 'fulfilled')
    const failures = results.filter((row) => row.status === 'rejected')
    expect(successes).toHaveLength(1)
    expect(failures.length).toBeGreaterThanOrEqual(1)
    expect(failures.every((row) => row.reason?.code === 'INVALID_OTP')).toBe(true)
    expect(await OtpCode.countDocuments({ phone, consumedAt: null })).toBe(0)
  })

  it('atomically increments wrong attempts and cannot bypass maxAttempts', async () => {
    const phone = '+971501111003'
    const sent = await authService.sendOtp(phone)
    const code = sent.test_otp
    const max = 5
    const wrong = await Promise.allSettled(
      Array.from({ length: max + 2 }, () => authService.verifyOtp(phone, '000000')),
    )
    expect(wrong.every((row) => row.status === 'rejected')).toBe(true)
    const otp = await OtpCode.findOne({ phone }).sort({ createdAt: -1 })
    expect(otp.attempts).toBeLessThanOrEqual(max)
    if (code) {
      await expect(authService.verifyOtp(phone, code)).rejects.toMatchObject({ code: 'INVALID_OTP' })
    }
  })
})

describe('refresh-token rotation concurrency', () => {
  it('rotates a refresh token exactly once under concurrent refresh', async () => {
    const customer = await Customer.create({ phone: '+971501111010', authProvider: 'otp', isActive: true })
    const tokens = await authService.issueSession(customer, 'customer')
    const results = await Promise.allSettled([
      authService.rotateSession(tokens.refreshToken),
      authService.rotateSession(tokens.refreshToken),
      authService.rotateSession(tokens.refreshToken),
    ])
    const ok = results.filter((row) => row.status === 'fulfilled')
    const bad = results.filter((row) => row.status === 'rejected')
    expect(ok).toHaveLength(1)
    expect(bad.length).toBe(2)
    expect(bad.every((row) => row.reason?.code === 'INVALID_REFRESH')).toBe(true)

    const activeRefresh = await RefreshSession.countDocuments({
      actorId: customer.id,
      actorType: 'customer',
      revokedAt: null,
    })
    expect(activeRefresh).toBe(1)
  })

  it('blocks refresh after logout-all / tokenVersion bump', async () => {
    const staff = await Staff.create({
      fullName: 'Mgr',
      email: 'refresh-mgr@example.com',
      passwordHash: await authService.hashPassword('password-12345678'),
      role: 'manager',
      isActive: true,
    })
    const tokens = await authService.issueSession(staff, 'staff')
    await authService.invalidateActorSessions(staff.id, 'staff')
    await expect(authService.rotateSession(tokens.refreshToken)).rejects.toMatchObject({ code: 'INVALID_REFRESH' })
  })

  it('barrier: logout-all during refresh prevents old-generation session issuance', async () => {
    const customer = await Customer.create({ phone: '+971501111099', authProvider: 'otp', isActive: true })
    const tokens = await authService.issueSession(customer, 'customer')
    let releaseBarrier
    const barrier = new Promise((resolve) => { releaseBarrier = resolve })

    const refreshPromise = authService.rotateSession(tokens.refreshToken, {}, {
      afterConsumeHook: async () => {
        // Consume already committed — logout-all can advance generation safely.
        await authService.invalidateActorSessions(customer.id, 'customer')
        await barrier
      },
    })

    await new Promise((r) => setTimeout(r, 30))
    releaseBarrier()
    await expect(refreshPromise).rejects.toMatchObject({ code: 'INVALID_REFRESH' })

    const active = await RefreshSession.countDocuments({
      actorId: customer.id,
      actorType: 'customer',
      revokedAt: null,
    })
    expect(active).toBe(0)
    const actor = await Customer.findById(customer.id).select('+tokenVersion')
    expect(actor.tokenVersion).toBeGreaterThanOrEqual(1)
  }, 15_000)

  it('password reset race invalidates in-flight refresh', async () => {
    const staff = await Staff.create({
      fullName: 'Reset Mgr',
      email: 'reset-mgr@example.com',
      passwordHash: await authService.hashPassword('password-12345678'),
      role: 'manager',
      isActive: true,
    })
    const tokens = await authService.issueSession(staff, 'staff')
    const refreshPromise = authService.rotateSession(tokens.refreshToken, {}, {
      afterConsumeHook: async () => {
        await authService.changeStaffPassword(staff.id, 'password-12345678', 'password-87654321')
      },
    })
    await expect(refreshPromise).rejects.toMatchObject({ code: 'INVALID_REFRESH' })
    expect(await RefreshSession.countDocuments({ actorId: staff.id, revokedAt: null })).toBe(0)
  }, 15_000)

  it('rejects refresh when session tokenVersion mismatches actor', async () => {
    const customer = await Customer.create({ phone: '+971501111011', authProvider: 'otp', isActive: true })
    const tokens = await authService.issueSession(customer, 'customer')
    // Bump actor version without revoking the refresh row (simulates stale session).
    await Customer.updateOne({ _id: customer.id }, { $inc: { tokenVersion: 1 } })
    await expect(authService.rotateSession(tokens.refreshToken)).rejects.toMatchObject({ code: 'INVALID_REFRESH' })
    expect(await RefreshSession.countDocuments({ actorId: customer.id, revokedAt: null })).toBe(0)
  })
})

describe('OTP delivery failure and supersession', () => {
  it('on delivery failure only invalidates the newly created OTP document', async () => {
    const phone = '+971501111020'
    process.env.NODE_ENV = 'test'
    const { config } = await import('../src/config/env.js')
    const originalProvider = config.otp.provider
    const originalUrl = config.otp.providerUrl
    config.otp.provider = 'http'
    config.otp.providerUrl = 'http://127.0.0.1:9/otp-fail'
    config.otp.apiKey = 'test-key'

    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => ({ ok: false, status: 502 })

    try {
      await expect(authService.sendOtp(phone)).rejects.toMatchObject({ code: 'OTP_DELIVERY_FAILED' })
      const docs = await OtpCode.find({ phone })
      expect(docs).toHaveLength(1)
      expect(docs[0].consumedAt).toBeTruthy()
      expect(docs[0].activeChallengeKey).toBeNull()
    } finally {
      globalThis.fetch = originalFetch
      config.otp.provider = originalProvider
      config.otp.providerUrl = originalUrl
    }
  })

  it('throws OTP_CONTENTION when challenge is superseded after delivery', async () => {
    const phone = '+971501111021'
    process.env.SHOW_TEST_OTP = 'true'
    process.env.OTP_PROVIDER = 'console'
    process.env.NODE_ENV = 'test'

    const results = await Promise.allSettled([
      authService.sendOtp(phone),
      authService.sendOtp(phone),
      authService.sendOtp(phone),
    ])
    const fulfilled = results.filter((row) => row.status === 'fulfilled')
    const contended = results.filter((row) => row.status === 'rejected' && row.reason?.code === 'OTP_CONTENTION')
    expect(fulfilled.length + contended.length).toBe(results.length)
    const active = await OtpCode.countDocuments({ phone, consumedAt: null, activeChallengeKey: { $ne: null } })
    expect(active).toBe(1)
  })
})
