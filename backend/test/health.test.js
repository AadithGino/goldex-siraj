import { afterEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import {
  assertProductionConfig,
  clearReadinessCache,
  getReadiness,
} from '../src/services/health.service.js'

afterEach(() => {
  clearReadinessCache()
})

describe('health endpoint', () => {
  it('returns a successful liveness response', async () => {
    const response = await request(app).get('/health/live').expect(200)
    expect(response.body).toEqual({ status: 'ok' })
    expect(response.headers['x-request-id']).toBeTruthy()
  })

  it('returns readiness payload (may be not_ready without mongo)', async () => {
    const response = await request(app).get('/health/ready')
    expect([200, 503]).toContain(response.status)
    expect(response.body.checks).toMatchObject({
      mongo: expect.any(Boolean),
      transactions: expect.any(Boolean),
      storage: expect.any(Boolean),
      config: expect.any(Boolean),
      indexes: expect.any(Boolean),
      otp: expect.any(Boolean),
    })
    if (response.status === 503) {
      expect(response.body.ready).toBe(false)
      expect(response.body.code === 'NOT_READY' || response.body.error?.code === 'NOT_READY' || response.body.status === 'not_ready' || response.body.ready === false).toBe(true)
      // Must explain *why* — not a bare 503.
      const details = response.body.details || response.body.error?.details?.details || response.body
      const checks = response.body.checks || response.body.error?.details?.checks
      expect(checks).toBeTruthy()
      const failed = Object.entries(checks || {}).filter(([, ok]) => !ok).map(([k]) => k)
      expect(failed.length).toBeGreaterThan(0)
      expect(details || failed).toBeTruthy()
    } else {
      expect(response.body.ready).toBe(true)
    }
    const raw = JSON.stringify(response.body)
    expect(raw).not.toMatch(/secretAccessKey|apiKey|passwordHash/i)
  })
})

describe('assertProductionConfig / readiness failure cases', () => {
  it('rejects insecure production cookie / local storage / console OTP', () => {
    expect(() => assertProductionConfig({
      nodeEnv: 'production',
      cookieSecure: false,
      clientOrigins: ['https://shop.example'],
      storage: { driver: 's3', s3: { region: 'me-central-1', bucket: 'b', accessKeyId: 'a', secretAccessKey: 's' } },
      otp: { provider: 'http', providerUrl: 'https://otp.example', apiKey: 'k', showTestOtp: false },
    })).toThrow(/COOKIE_SECURE/)

    expect(() => assertProductionConfig({
      nodeEnv: 'production',
      cookieSecure: true,
      clientOrigins: ['https://shop.example'],
      storage: { driver: 'local', s3: {} },
      otp: { provider: 'http', providerUrl: 'https://otp.example', apiKey: 'k', showTestOtp: false },
    })).toThrow(/STORAGE_DRIVER/)

    expect(() => assertProductionConfig({
      nodeEnv: 'production',
      cookieSecure: true,
      clientOrigins: ['https://shop.example'],
      storage: { driver: 's3', s3: { region: 'me-central-1', bucket: 'b', accessKeyId: 'a', secretAccessKey: 's' } },
      otp: { provider: 'console', providerUrl: undefined, apiKey: undefined, showTestOtp: false },
    })).toThrow(/OTP_PROVIDER/)
  })

  it('marks otp check failed for incomplete http provider', async () => {
    clearReadinessCache()
    const result = await getReadiness({
      nodeEnv: 'development',
      cookieSecure: false,
      clientOrigins: ['http://localhost:5173'],
      storage: { driver: 'local', s3: {} },
      otp: {
        provider: 'http',
        providerUrl: undefined,
        apiKey: undefined,
        showTestOtp: false,
        ttlSeconds: 600,
        maxAttempts: 5,
      },
    }, { bypassCache: true })

    expect(result.checks.otp).toBe(false)
    expect(result.details.otp.reason).toBe('otp_http_config_incomplete')
    expect(result.details.otp.apiKey).toBeUndefined()
    expect(JSON.stringify(result)).not.toMatch(/apiKey|secretAccessKey/i)
  })

  it('caches readiness briefly', async () => {
    clearReadinessCache()
    const a = await getReadiness(undefined, { bypassCache: true })
    const b = await getReadiness()
    expect(b.cached).toBe(true)
    expect(b.ready).toBe(a.ready)
  })
})
