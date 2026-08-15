import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import { Customer } from '../src/models/auth.models.js'
import { PendingUpload } from '../src/models/upload.models.js'
import { issueSession } from '../src/services/auth.service.js'
import { SESSION_COOKIES } from '../src/utils/sessionCookies.js'
import app from '../src/app.js'

let mongoServer

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-upload-test'))
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  const collections = mongoose.connection.collections
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})))
})

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
}

async function loginCustomer(phone = '+971509999001') {
  const customer = await Customer.create({ phone, fullName: 'Upload Customer', authProvider: 'otp', isActive: true })
  const tokens = await issueSession(customer, 'customer')
  const jar = {
    [SESSION_COOKIES.customerAccess]: tokens.accessToken,
    [SESSION_COOKIES.customerRefresh]: tokens.refreshToken,
  }
  return { customer, jar }
}

const png1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

describe('return proof upload association', () => {
  it('stores pending proof owned by customer and rejects invalid signatures', async () => {
    const { jar } = await loginCustomer()

    const bad = await request(app)
      .post('/api/v1/customer/media/return-proof')
      .set('Cookie', cookieHeader(jar))
      .attach('file', Buffer.from('%PDF-fake'), 'evil.pdf')
      .expect(415)
    expect(bad.body.error.code).toMatch(/INVALID_FILE|MIME/)

    const okRes = await request(app)
      .post('/api/v1/customer/media/return-proof')
      .set('Cookie', cookieHeader(jar))
      .attach('file', png1x1, 'proof.png')
      .expect(201)

    expect(okRes.body.data.key).toMatch(/return-proof-images\//)
    const pending = await PendingUpload.findOne({ key: okRes.body.data.key })
    expect(pending).toBeTruthy()
    expect(pending.status).toBe('pending')
  }, 30_000)
})

describe('customer media presign', () => {
  it('issues a presign ticket for sell invoice uploads', async () => {
    const { jar } = await loginCustomer('+971509999002')

    const badKind = await request(app)
      .post('/api/v1/customer/media/presign')
      .set('Cookie', cookieHeader(jar))
      .send({ kind: 'product', content_type: 'image/png', content_length: 100 })
      .expect(422)
    expect(badKind.body.error).toBeTruthy()

    const badMime = await request(app)
      .post('/api/v1/customer/media/presign')
      .set('Cookie', cookieHeader(jar))
      .send({ kind: 'custom-jewellery', content_type: 'application/pdf', content_length: 100 })
      .expect(415)
    expect(badMime.body.error.code).toMatch(/INVALID_FILE/)

    const okRes = await request(app)
      .post('/api/v1/customer/media/presign')
      .set('Cookie', cookieHeader(jar))
      .send({ kind: 'sell-invoice', content_type: 'application/pdf', content_length: 2048 })
      .expect(200)

    expect(['proxy', 's3']).toContain(okRes.body.data.mode)
    expect(okRes.body.data.content_type).toBe('application/pdf')
    if (okRes.body.data.mode === 'proxy') {
      expect(okRes.body.data.upload_path).toBe('/customer/media/sell-invoice')
    } else {
      expect(okRes.body.data.key).toMatch(/sell-invoice-files\//)
      expect(okRes.body.data.upload_url).toMatch(/^https?:\/\//)
      expect(okRes.body.data.headers?.['content-type']).toBe('application/pdf')
    }
  }, 30_000)
})

describe('health ready', () => {
  it('reports mongo + transaction checks when replica set is available', async () => {
    const res = await request(app).get('/health/ready')
    expect(res.body.checks).toBeTruthy()
    expect(res.body.checks.mongo).toBe(true)
    expect(res.body.checks.transactions).toBe(true)
    // Indexes / S3 may still fail readiness until migrate:indexes + prod storage.
    expect([200, 503]).toContain(res.status)
  }, 30_000)
})
