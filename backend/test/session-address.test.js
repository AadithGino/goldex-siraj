import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import { Customer, Staff } from '../src/models/auth.models.js'
import { Address } from '../src/models/commerce.models.js'
import { hashPassword, issueSession } from '../src/services/auth.service.js'
import * as customerService from '../src/services/customer.service.js'
import { SESSION_COOKIES } from '../src/utils/sessionCookies.js'
import app from '../src/app.js'

let mongoServer

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-session-test'))
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

function absorbCookies(res, jar) {
  const raw = res.headers['set-cookie']
  if (!raw) return jar
  for (const line of Array.isArray(raw) ? raw : [raw]) {
    const [pair] = line.split(';')
    const eq = pair.indexOf('=')
    if (eq < 0) continue
    const name = pair.slice(0, eq)
    const value = pair.slice(eq + 1)
    if (line.toLowerCase().includes('max-age=0') || value === '') delete jar[name]
    else jar[name] = value
  }
  return jar
}

async function loginCustomer(phone = '+971501111001') {
  const customer = await Customer.create({ phone, fullName: 'Session Customer', authProvider: 'otp', isActive: true })
  const tokens = await issueSession(customer, 'customer')
  const jar = {
    [SESSION_COOKIES.customerAccess]: tokens.accessToken,
    [SESSION_COOKIES.customerRefresh]: tokens.refreshToken,
  }
  return { customer, tokens, jar }
}

async function loginStaff(email = 'manager@example.com', role = 'manager') {
  const staff = await Staff.create({
    fullName: 'Session Manager',
    email,
    passwordHash: await hashPassword('password-12345678'),
    role,
    isActive: true,
  })
  const tokens = await issueSession(staff, 'staff')
  const jar = {
    [SESSION_COOKIES.staffAccess]: tokens.accessToken,
    [SESSION_COOKIES.staffRefresh]: tokens.refreshToken,
  }
  return { staff, tokens, jar }
}

const validAddress = {
  label: 'home',
  recipient_name: 'Session Customer',
  phone: '501111001',
  line1: 'Marina Walk Tower',
  city: 'Dubai',
  state: 'Dubai',
  country: 'United Arab Emirates',
  is_default: true,
}

describe('customer/staff session isolation', () => {
  it('allows customer and staff sessions to coexist without overwriting cookies', async () => {
    const { jar: customerJar } = await loginCustomer()
    const { jar: staffJar } = await loginStaff()
    const jar = { ...customerJar, ...staffJar }

    const customerMe = await request(app)
      .get('/api/v1/customer/auth/me')
      .set('Cookie', cookieHeader(jar))
      .expect(200)
    expect(customerMe.body.data.phone).toBe('+971501111001')

    const staffMe = await request(app)
      .get('/api/v1/staff/auth/me')
      .set('Cookie', cookieHeader(jar))
      .expect(200)
    expect(staffMe.body.data.email).toBe('manager@example.com')

    expect(jar[SESSION_COOKIES.customerAccess]).toBeTruthy()
    expect(jar[SESSION_COOKIES.staffAccess]).toBeTruthy()
  }, 20_000)

  it('staff login does not break customer address creation', async () => {
    const { jar: customerJar } = await loginCustomer()
    await Staff.create({
      fullName: 'Cashier',
      email: 'manager2@example.com',
      passwordHash: await hashPassword('password-12345678'),
      role: 'manager',
    })
    const staffRes = await request(app)
      .post('/api/v1/staff/auth/login')
      .send({ email: 'manager2@example.com', password: 'password-12345678' })
      .expect(200)
    const jar = absorbCookies(staffRes, { ...customerJar })
    expect(jar[SESSION_COOKIES.customerAccess]).toBeTruthy()
    expect(jar[SESSION_COOKIES.staffAccess]).toBeTruthy()
    expect(jar[SESSION_COOKIES.legacyAccess]).toBeUndefined()

    const addressRes = await request(app)
      .post('/api/v1/customer/addresses')
      .set('Cookie', cookieHeader(jar))
      .send(validAddress)
      .expect(201)
    expect(addressRes.body.data.recipient_name || addressRes.body.data.recipientName).toBeTruthy()
  })

  it('customer logout clears only customer cookies', async () => {
    const { jar: customerJar } = await loginCustomer()
    const { jar: staffJar } = await loginStaff('logout-staff@example.com')
    const jar = { ...customerJar, ...staffJar }

    const logout = await request(app)
      .post('/api/v1/customer/auth/logout')
      .set('Cookie', cookieHeader(jar))
      .expect(204)
    absorbCookies(logout, jar)

    expect(jar[SESSION_COOKIES.customerAccess]).toBeUndefined()
    expect(jar[SESSION_COOKIES.customerRefresh]).toBeUndefined()
    expect(jar[SESSION_COOKIES.staffAccess]).toBeTruthy()

    await request(app)
      .get('/api/v1/customer/auth/me')
      .set('Cookie', cookieHeader(jar))
      .expect(401)

    await request(app)
      .get('/api/v1/staff/auth/me')
      .set('Cookie', cookieHeader(jar))
      .expect(200)
  })

  it('refresh rotates only the matching portal session', async () => {
    const { jar: customerJar } = await loginCustomer('+971502222002')
    const { jar: staffJar } = await loginStaff('refresh@example.com')
    const jar = { ...customerJar, ...staffJar }
    const priorStaffAccess = jar[SESSION_COOKIES.staffAccess]

    const refreshed = await request(app)
      .post('/api/v1/customer/auth/refresh')
      .set('Cookie', cookieHeader(jar))
      .expect(200)
    absorbCookies(refreshed, jar)

    expect(jar[SESSION_COOKIES.customerAccess]).toBeTruthy()
    expect(jar[SESSION_COOKIES.staffAccess]).toBe(priorStaffAccess)
  })

  it('rejects deactivated customer tokens', async () => {
    const { customer, jar } = await loginCustomer('+971503333003')
    await Customer.updateOne({ _id: customer.id }, { $set: { isActive: false } })
    const res = await request(app)
      .get('/api/v1/customer/auth/me')
      .set('Cookie', cookieHeader(jar))
      .expect(401)
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED')
  })

  it('bumps tokenVersion and revokes sessions when admin deactivates customer', async () => {
    const { customer, jar } = await loginCustomer('+971503333013')
    const before = await Customer.findById(customer.id).select('+tokenVersion')
    const { updateCustomer } = await import('../src/services/admin.service.js')
    await updateCustomer(customer.id, { is_active: false })
    const after = await Customer.findById(customer.id).select('+tokenVersion')
    expect(after.isActive).toBe(false)
    expect(after.tokenVersion).toBe((before.tokenVersion || 0) + 1)
    const res = await request(app)
      .get('/api/v1/customer/auth/me')
      .set('Cookie', cookieHeader(jar))
      .expect(401)
    expect(['ACCOUNT_DISABLED', 'INVALID_TOKEN']).toContain(res.body.error.code)
  })

  it('rejects deactivated staff tokens', async () => {
    const { staff, jar } = await loginStaff('disabled@example.com')
    await Staff.updateOne({ _id: staff.id }, { $set: { isActive: false } })
    const res = await request(app)
      .get('/api/v1/staff/auth/me')
      .set('Cookie', cookieHeader(jar))
      .expect(401)
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED')
  })

  it('rejects stale tokenVersion', async () => {
    const { staff, jar } = await loginStaff('stale@example.com')
    await Staff.updateOne({ _id: staff.id }, { $inc: { tokenVersion: 1 } })
    const res = await request(app)
      .get('/api/v1/staff/auth/me')
      .set('Cookie', cookieHeader(jar))
      .expect(401)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })
})

describe('address ownership and UAE validation', () => {
  it('ignores request body customerId and binds ownership to auth.sub', async () => {
    const { customer, jar } = await loginCustomer('+971504444004')
    const other = await Customer.create({ phone: '+971505555005', authProvider: 'otp' })

    const res = await request(app)
      .post('/api/v1/customer/addresses')
      .set('Cookie', cookieHeader(jar))
      .send({ ...validAddress, customer_id: other.id, customerId: other.id, role: 'owner' })
      .expect(201)

    const created = await Address.findById(res.body.data.id || res.body.data._id)
    expect(String(created.customerId)).toBe(String(customer.id))
    expect(String(created.customerId)).not.toBe(String(other.id))
  })

  it('prevents modifying another customer address', async () => {
    const { customer: a } = await loginCustomer('+971506666006')
    const { jar: jarB } = await loginCustomer('+971507777007')
    const owned = await Address.create({
      customerId: a.id,
      label: 'home',
      recipientName: 'A',
      phone: '+971506666006',
      line1: 'Street 1',
      city: 'Dubai',
      state: 'Dubai',
      country: 'United Arab Emirates',
    })

    await request(app)
      .patch(`/api/v1/customer/addresses/${owned.id}`)
      .set('Cookie', cookieHeader(jarB))
      .send({ recipient_name: 'Hijack' })
      .expect(404)
  })

  it('keeps only one default address', async () => {
    const { customer } = await loginCustomer('+971508888008')
    await customerService.saveAddress(customer.id, { ...validAddress, is_default: true, phone: '508888008' })
    await customerService.saveAddress(customer.id, {
      ...validAddress,
      label: 'work',
      phone: '508888008',
      line1: 'Business Bay',
      is_default: true,
    })
    const defaults = await Address.find({ customerId: customer.id, isDefault: true })
    expect(defaults).toHaveLength(1)
    expect(defaults[0].label).toBe('work')
  })
})
