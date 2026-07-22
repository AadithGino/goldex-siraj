import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, '..')

const baseEnv = {
  NODE_ENV: 'test',
  OTP_PROVIDER: 'console',
  SHOW_TEST_OTP: 'true',
  OTP_TTL_SECONDS: '600',
  OTP_MAX_ATTEMPTS: '5',
  JWT_ACCESS_SECRET: 'development-access-secret-change-me-now',
  JWT_REFRESH_SECRET: 'development-refresh-secret-change-me',
  COOKIE_SECURE: 'false',
  STORAGE_DRIVER: 'local',
  STORAGE_PUBLIC_URL: 'http://localhost:4000/uploads',
  CLIENT_ORIGINS: 'http://localhost:5173',
  LOG_LEVEL: 'silent',
}

async function loadAuthWithEnv(overrides = {}) {
  vi.resetModules()
  for (const [key, value] of Object.entries({ ...baseEnv, ...overrides })) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = String(value)
  }
  process.env.MONGODB_URI = mongoUri
  const envMod = await import('../src/config/env.js')
  const auth = await import('../src/services/auth.service.js')
  const models = await import('../src/models/auth.models.js')
  return { ...auth, ...models, canExposeTestOtp: envMod.canExposeTestOtp, config: envMod.config }
}

let mongoServer
let mongoUri

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  mongoUri = mongoServer.getUri('goldex-otp-test')
  await mongoose.connect(mongoUri)
}, 60_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  const collections = mongoose.connection.collections
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})))
})

describe('canExposeTestOtp', () => {
  it('is true only when non-production, console provider, and SHOW_TEST_OTP', async () => {
    const { canExposeTestOtp } = await loadAuthWithEnv({ SHOW_TEST_OTP: 'true', OTP_PROVIDER: 'console', NODE_ENV: 'test' })
    expect(canExposeTestOtp()).toBe(true)
  })

  it('is false when SHOW_TEST_OTP=false', async () => {
    const { canExposeTestOtp } = await loadAuthWithEnv({ SHOW_TEST_OTP: 'false' })
    expect(canExposeTestOtp()).toBe(false)
  })

  it('is false when OTP_PROVIDER=http', async () => {
    const { canExposeTestOtp } = await loadAuthWithEnv({
      SHOW_TEST_OTP: 'true',
      OTP_PROVIDER: 'http',
      OTP_PROVIDER_URL: 'https://otp.example.com/send',
      OTP_PROVIDER_API_KEY: 'test-key',
    })
    expect(canExposeTestOtp()).toBe(false)
  })
})

describe('development test OTP', () => {
  it('returns a random 6-digit OTP that verifies successfully', async () => {
    const { sendOtp, verifyOtp, Customer, OtpCode } = await loadAuthWithEnv({ SHOW_TEST_OTP: 'true' })
    const phone = '+971501111001'
    const first = await sendOtp(phone)
    expect(first.expires_in).toBe(600)
    expect(first.test_otp).toMatch(/^\d{6}$/)

    const stored = await OtpCode.findOne({ phone }).select('+codeHash')
    expect(stored).toBeTruthy()
    expect(stored.codeHash).toBeTruthy()
    expect(JSON.stringify(stored.toObject())).not.toContain(first.test_otp)

    const customer = await verifyOtp(phone, first.test_otp)
    expect(customer.phone).toBe(phone)
    expect(await Customer.countDocuments({ phone })).toBe(1)

    const customerDoc = await Customer.findOne({ phone }).lean()
    expect(JSON.stringify(customerDoc)).not.toMatch(/\b\d{6}\b/)
  })

  it('invalidates the earlier OTP when another is requested', async () => {
    const { sendOtp, verifyOtp } = await loadAuthWithEnv({ SHOW_TEST_OTP: 'true' })
    const phone = '+971501111002'
    const first = await sendOtp(phone)
    const second = await sendOtp(phone)
    expect(second.test_otp).toMatch(/^\d{6}$/)
    expect(second.test_otp).not.toBe(first.test_otp)

    await expect(verifyOtp(phone, first.test_otp)).rejects.toMatchObject({ code: 'INVALID_OTP' })
    const customer = await verifyOtp(phone, second.test_otp)
    expect(customer.phone).toBe(phone)
  })

  it('omits test_otp when SHOW_TEST_OTP=false', async () => {
    const { sendOtp } = await loadAuthWithEnv({ SHOW_TEST_OTP: 'false' })
    const result = await sendOtp('+971501111003')
    expect(result.expires_in).toBe(600)
    expect(result).not.toHaveProperty('test_otp')
  })

  it('omits test_otp when OTP_PROVIDER=http', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const { sendOtp } = await loadAuthWithEnv({
        SHOW_TEST_OTP: 'true',
        OTP_PROVIDER: 'http',
        OTP_PROVIDER_URL: 'https://otp.example.com/send',
        OTP_PROVIDER_API_KEY: 'test-key',
      })
      const result = await sendOtp('+971501111004')
      expect(result).not.toHaveProperty('test_otp')
      expect(fetchMock).toHaveBeenCalledOnce()
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.code).toMatch(/^\d{6}$/)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('keeps request limits, expiry and maximum-attempt protections', async () => {
    const { sendOtp, verifyOtp, OtpCode, config } = await loadAuthWithEnv({
      SHOW_TEST_OTP: 'true',
      OTP_MAX_ATTEMPTS: '3',
      OTP_TTL_SECONDS: '120',
    })
    const phone = '+971501111005'

    for (let i = 0; i < 5; i += 1) await sendOtp(phone)
    await expect(sendOtp(phone)).rejects.toMatchObject({ code: 'OTP_LIMIT', statusCode: 429 })

    const limitedPhone = '+971501111006'
    const issued = await sendOtp(limitedPhone)
    for (let i = 0; i < config.otp.maxAttempts; i += 1) {
      await expect(verifyOtp(limitedPhone, '000000')).rejects.toMatchObject({ code: 'INVALID_OTP', statusCode: 401 })
    }
    await expect(verifyOtp(limitedPhone, issued.test_otp)).rejects.toMatchObject({ code: 'INVALID_OTP', statusCode: 401 })

    const expiredPhone = '+971501111007'
    const expiredIssue = await sendOtp(expiredPhone)
    await OtpCode.updateMany({ phone: expiredPhone }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
    await expect(verifyOtp(expiredPhone, expiredIssue.test_otp)).rejects.toMatchObject({ code: 'INVALID_OTP', statusCode: 401 })
  })
})

describe('production SHOW_TEST_OTP guard', () => {
  it('rejects SHOW_TEST_OTP=true at startup', () => {
    const script = `
      process.env.NODE_ENV = 'production'
      process.env.SHOW_TEST_OTP = 'true'
      process.env.OTP_PROVIDER = 'http'
      process.env.OTP_PROVIDER_URL = 'https://otp.example.com/send'
      process.env.OTP_PROVIDER_API_KEY = 'production-key'
      process.env.JWT_ACCESS_SECRET = ${JSON.stringify('p'.repeat(40))}
      process.env.JWT_REFRESH_SECRET = ${JSON.stringify('q'.repeat(40))}
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/goldex'
      process.env.STORAGE_PUBLIC_URL = 'https://example.com/uploads'
      await import(${JSON.stringify(path.join(backendRoot, 'src/config/env.js'))})
    `
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: backendRoot,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production' },
    })
    expect(result.status).not.toBe(0)
    expect(`${result.stderr}${result.stdout}`).toMatch(/SHOW_TEST_OTP is forbidden in production/)
  })
})
