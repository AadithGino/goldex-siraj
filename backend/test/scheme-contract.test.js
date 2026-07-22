/**
 * Phase 22.6 — Scheme API contract, installment pay, enrollment concurrency, completion.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import app from '../src/app.js'
import { Customer, Staff } from '../src/models/auth.models.js'
import { PaymentEvent, WalletTransaction } from '../src/models/commerce.models.js'
import { Scheme, SchemeEnrollment, SchemePaymentReference } from '../src/models/scheme.models.js'
import { hashPassword, issueSession } from '../src/services/auth.service.js'
import * as schemeService from '../src/services/scheme.service.js'
import { SESSION_COOKIES } from '../src/utils/sessionCookies.js'

let mongoServer
let staffCookie
let customerCookie
let customer
let otherCustomer
let manager

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
}

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-scheme-contract'))
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})))
  manager = await Staff.create({
    fullName: 'Scheme Manager',
    email: 'scheme-contract@example.com',
    passwordHash: await hashPassword('password-12345678'),
    role: 'manager',
    isActive: true,
  })
  const staffTokens = await issueSession(manager, 'staff')
  staffCookie = cookieHeader({
    [SESSION_COOKIES.staffAccess]: staffTokens.accessToken,
    [SESSION_COOKIES.staffRefresh]: staffTokens.refreshToken,
  })
  customer = await Customer.create({
    phone: '+971501888001',
    fullName: 'Scheme Buyer',
    email: 'scheme.buyer@example.com',
    authProvider: 'otp',
    isActive: true,
  })
  otherCustomer = await Customer.create({
    phone: '+971501888002',
    fullName: 'Other Buyer',
    authProvider: 'otp',
    isActive: true,
  })
  const cTokens = await issueSession(customer, 'customer')
  customerCookie = cookieHeader({
    [SESSION_COOKIES.customerAccess]: cTokens.accessToken,
    [SESSION_COOKIES.customerRefresh]: cTokens.refreshToken,
  })
})

describe('Phase 22.6 scheme create/update contract', () => {
  it('creates and updates with exact FE payload; rejects unknown/empty/fractional/invalid', async () => {
    const payload = {
      name: 'Gold Save',
      name_ar: 'ذهب',
      description: 'Monthly plan',
      description_ar: null,
      monthly_amount: 100,
      tenure_months: 11,
      bonus_months: 1,
      is_active: true,
    }
    const create = await request(app)
      .post('/api/v1/admin/schemes')
      .set('Cookie', staffCookie)
      .send(payload)
    expect(create.status).toBe(201)
    expect(create.body.data.name).toBe('Gold Save')
    expect(create.body.data.monthly_amount).toBe(100)
    expect(create.body.data.tenure_months).toBe(11)
    expect(create.body.data.bonus_months).toBe(1)

    const id = create.body.data.id
    const update = await request(app)
      .patch(`/api/v1/admin/schemes/${id}`)
      .set('Cookie', staffCookie)
      .send({ name: 'Gold Save Plus', monthly_amount: 120 })
    expect(update.status).toBe(200)
    expect(update.body.data.name).toBe('Gold Save Plus')
    expect(update.body.data.monthly_amount).toBe(120)

    expect((await request(app).post('/api/v1/admin/schemes').set('Cookie', staffCookie)
      .send({ ...payload, code: 'SAVE', unknown_field: true })).status).toBe(422)
    expect((await request(app).patch(`/api/v1/admin/schemes/${id}`).set('Cookie', staffCookie)
      .send({})).status).toBe(422)
    expect((await request(app).post('/api/v1/admin/schemes').set('Cookie', staffCookie)
      .send({ ...payload, tenure_months: 1.5 })).status).toBe(422)
    expect((await request(app).post('/api/v1/admin/schemes').set('Cookie', staffCookie)
      .send({ ...payload, monthly_amount: Number.NaN })).status).toBe(422)
  })

  it('editing source scheme does not alter existing enrollment snapshots', async () => {
    const scheme = await Scheme.create({
      name: 'Snap', monthlyAmount: 50, tenureMonths: 3, bonusMonths: 1, isActive: true,
    })
    const enrollment = await schemeService.enroll(customer.id, scheme.id)
    expect(enrollment.monthlyAmountSnapshot).toBe(50)
    expect(enrollment.tenureMonthsSnapshot).toBe(3)
    expect(enrollment.bonusMonthsSnapshot).toBe(1)
    const due0 = enrollment.installments[0].dueDate.toISOString()

    await request(app)
      .patch(`/api/v1/admin/schemes/${scheme.id}`)
      .set('Cookie', staffCookie)
      .send({ monthly_amount: 999, tenure_months: 12, bonus_months: 5, name: 'Changed' })

    const refreshed = await SchemeEnrollment.findById(enrollment.id)
    expect(refreshed.monthlyAmountSnapshot).toBe(50)
    expect(refreshed.tenureMonthsSnapshot).toBe(3)
    expect(refreshed.bonusMonthsSnapshot).toBe(1)
    expect(refreshed.installments[0].amount).toBe(50)
    expect(refreshed.installments[0].dueDate.toISOString()).toBe(due0)
  })
})

describe('Phase 22.6 installment pay contract', () => {
  async function seedEnrollment() {
    const scheme = await Scheme.create({
      name: 'Pay Plan', monthlyAmount: 100, tenureMonths: 2, bonusMonths: 0, isActive: true,
    })
    return schemeService.enroll(customer.id, scheme.id)
  }

  it('rejects legacy payment_method-only body without amount (contract mismatch guard)', async () => {
    const enrollment = await seedEnrollment()
    const installmentId = enrollment.installments[0].id
    const legacy = await request(app)
      .post(`/api/v1/admin/schemes/installments/${installmentId}/pay`)
      .set('Cookie', staffCookie)
      .send({ payment_method: 'cash', note: 'Received at counter' })
    expect(legacy.status).toBe(422)
  })

  it('accepts canonical payload on both pay endpoints; cash without ref; mismatch/bank/wallet rejected', async () => {
    const enrollment = await seedEnrollment()
    const installmentId = enrollment.installments[0].id
    const canonical = {
      amount: 100,
      payment_method: 'cash',
      transaction_ref: null,
      note: 'Received at counter',
    }
    const byId = await request(app)
      .post(`/api/v1/admin/schemes/installments/${installmentId}/pay`)
      .set('Cookie', staffCookie)
      .send(canonical)
    expect(byId.status).toBe(200)
    expect(byId.body.data.invoice_number).toMatch(/^SCH-/)
    expect(byId.body.data.payment_method).toBe('cash')
    expect(byId.body.data.amount).toBe(100)

    const enrollment2 = await seedEnrollment()
    // Force unique scheme by creating another for nested path
    const nested = await request(app)
      .post(`/api/v1/admin/schemes/enrollments/${enrollment2.id}/installments/${enrollment2.installments[0].id}/pay`)
      .set('Cookie', staffCookie)
      .send({ ...canonical, note: 'Nested path' })
    expect(nested.status).toBe(200)

    const mismatch = await request(app)
      .post(`/api/v1/admin/schemes/installments/${enrollment2.installments[1].id}/pay`)
      .set('Cookie', staffCookie)
      .send({ amount: 50, payment_method: 'cash' })
    expect(mismatch.status).toBe(409)
    expect(mismatch.body.error.code).toBe('INSTALLMENT_AMOUNT_MISMATCH')

    const noRef = await request(app)
      .post(`/api/v1/admin/schemes/installments/${enrollment2.installments[1].id}/pay`)
      .set('Cookie', staffCookie)
      .send({ amount: 100, payment_method: 'bank_transfer' })
    expect(noRef.status).toBe(422)

    const wallet = await request(app)
      .post(`/api/v1/admin/schemes/installments/${enrollment2.installments[1].id}/pay`)
      .set('Cookie', staffCookie)
      .send({ amount: 100, payment_method: 'wallet' })
    expect(wallet.status).toBe(422)
  })

  it('concurrent installment payment creates one PaymentEvent and invoice; reused ref rejected', async () => {
    const enrollment = await seedEnrollment()
    const installmentId = enrollment.installments[0].id
    const body = {
      amount: 100,
      payment_method: 'bank_transfer',
      transaction_ref: 'TXN-UNIQUE-1',
      note: 'Banked',
    }
    const results = await Promise.allSettled([
      request(app).post(`/api/v1/admin/schemes/installments/${installmentId}/pay`).set('Cookie', staffCookie).send(body),
      request(app).post(`/api/v1/admin/schemes/installments/${installmentId}/pay`).set('Cookie', staffCookie).send(body),
    ])
    const statuses = results.map((r) => (r.status === 'fulfilled' ? r.value.status : 500))
    expect(statuses.filter((s) => s === 200)).toHaveLength(2) // one real + one idempotent
    const events = await PaymentEvent.find({
      schemeInstallmentId: installmentId,
    })
    expect(events).toHaveLength(1)
    expect(events[0].eventType).toBe('scheme_installment_paid')
    expect(await PaymentEvent.countDocuments({ eventType: 'scheme_installment_ref' })).toBe(0)
    expect(await SchemePaymentReference.countDocuments({
      normalizedReference: 'TXN-UNIQUE-1',
    })).toBe(1)
    const refreshed = await SchemeEnrollment.findById(enrollment.id)
    expect(refreshed.totalPaid).toBe(100)
    expect(refreshed.installments.filter((i) => i.paymentStatus === 'paid')).toHaveLength(1)

    const other = await request(app)
      .post(`/api/v1/admin/schemes/installments/${enrollment.installments[1].id}/pay`)
      .set('Cookie', staffCookie)
      .send({ amount: 100, payment_method: 'bank_transfer', transaction_ref: 'TXN-UNIQUE-1' })
    expect(other.status).toBe(409)
    expect(other.body.error.code).toBe('SCHEME_TXN_REF_REUSED')
  })

  it('idempotent replay matches; conflicting method/ref returns IDEMPOTENCY_CONFLICT without mutation', async () => {
    const enrollment = await seedEnrollment()
    const cashId = enrollment.installments[0].id
    const bankId = enrollment.installments[1].id

    const cashPay = await request(app)
      .post(`/api/v1/admin/schemes/installments/${cashId}/pay`)
      .set('Cookie', staffCookie)
      .send({ amount: 100, payment_method: 'cash', transaction_ref: null, note: 'Counter' })
    expect(cashPay.status).toBe(200)
    expect(cashPay.body.data.idempotent).toBe(false)

    const cashReplay = await request(app)
      .post(`/api/v1/admin/schemes/installments/${cashId}/pay`)
      .set('Cookie', staffCookie)
      .send({ amount: 100, payment_method: 'cash', note: 'Different note ok' })
    expect(cashReplay.status).toBe(200)
    expect(cashReplay.body.data.idempotent).toBe(true)
    expect(await PaymentEvent.countDocuments({ schemeInstallmentId: cashId })).toBe(1)
    expect(await SchemePaymentReference.countDocuments()).toBe(0)

    const cashAsCard = await request(app)
      .post(`/api/v1/admin/schemes/installments/${cashId}/pay`)
      .set('Cookie', staffCookie)
      .send({ amount: 100, payment_method: 'card', transaction_ref: 'CARD-1' })
    expect(cashAsCard.status).toBe(409)
    expect(cashAsCard.body.error.code).toBe('IDEMPOTENCY_CONFLICT')

    const bankPay = await request(app)
      .post(`/api/v1/admin/schemes/enrollments/${enrollment.id}/installments/${bankId}/pay`)
      .set('Cookie', staffCookie)
      .send({ amount: 100, payment_method: 'bank_transfer', transaction_ref: 'Bank-Ref-9', note: 'Wire' })
    expect(bankPay.status).toBe(200)
    const invoice = bankPay.body.data.invoice_number
    const paidAt = bankPay.body.data.paid_at

    const bankReplay = await request(app)
      .post(`/api/v1/admin/schemes/installments/${bankId}/pay`)
      .set('Cookie', staffCookie)
      .send({ amount: 100, payment_method: 'bank_transfer', transaction_ref: 'bank-ref-9' })
    expect(bankReplay.status).toBe(200)
    expect(bankReplay.body.data.idempotent).toBe(true)

    const otherRef = await request(app)
      .post(`/api/v1/admin/schemes/installments/${bankId}/pay`)
      .set('Cookie', staffCookie)
      .send({ amount: 100, payment_method: 'bank_transfer', transaction_ref: 'OTHER-REF' })
    expect(otherRef.status).toBe(409)
    expect(otherRef.body.error.code).toBe('IDEMPOTENCY_CONFLICT')

    const asCash = await request(app)
      .post(`/api/v1/admin/schemes/installments/${bankId}/pay`)
      .set('Cookie', staffCookie)
      .send({ amount: 100, payment_method: 'cash' })
    expect(asCash.status).toBe(409)
    expect(asCash.body.error.code).toBe('IDEMPOTENCY_CONFLICT')

    const saved = await SchemeEnrollment.findById(enrollment.id)
    const bankInst = saved.installments.id(bankId)
    expect(bankInst.paymentMethod).toBe('bank_transfer')
    expect(bankInst.transactionRef).toBe('Bank-Ref-9')
    expect(bankInst.note).toBe('Wire')
    expect(bankInst.invoiceNumber).toBe(invoice)
    expect(new Date(bankInst.paidAt).toISOString()).toBe(new Date(paidAt).toISOString())
    expect(await PaymentEvent.countDocuments({ schemeInstallmentId: bankId })).toBe(1)
    expect(await SchemePaymentReference.countDocuments({ normalizedReference: 'BANK-REF-9' })).toBe(1)
    expect(await SchemePaymentReference.countDocuments({ normalizedReference: 'OTHER-REF' })).toBe(0)
  })

  it('concurrent identical cash creates one event and zero reference locks; concurrent shared bank ref has one winner', async () => {
    const a = await seedEnrollment()
    const b = await seedEnrollment()
    const cashBody = { amount: 100, payment_method: 'cash', note: 'Cash' }
    const cashId = a.installments[0].id
    const cashResults = await Promise.allSettled([
      request(app).post(`/api/v1/admin/schemes/installments/${cashId}/pay`).set('Cookie', staffCookie).send(cashBody),
      request(app).post(`/api/v1/admin/schemes/installments/${cashId}/pay`).set('Cookie', staffCookie).send(cashBody),
    ])
    expect(cashResults.filter((r) => r.status === 'fulfilled' && r.value.status === 200)).toHaveLength(2)
    expect(await PaymentEvent.countDocuments({ schemeInstallmentId: cashId })).toBe(1)
    expect(await SchemePaymentReference.countDocuments()).toBe(0)

    const shared = { amount: 100, payment_method: 'bank_transfer', transaction_ref: 'SHARED-REF' }
    const idA = a.installments[1].id
    const idB = b.installments[0].id
    const race = await Promise.allSettled([
      request(app).post(`/api/v1/admin/schemes/installments/${idA}/pay`).set('Cookie', staffCookie).send(shared),
      request(app).post(`/api/v1/admin/schemes/installments/${idB}/pay`).set('Cookie', staffCookie).send(shared),
    ])
    const fulfilled = race.filter((r) => r.status === 'fulfilled').map((r) => r.value)
    const wins = fulfilled.filter((r) => r.status === 200)
    const losses = fulfilled.filter((r) => r.status === 409)
    expect(wins).toHaveLength(1)
    expect(losses.length).toBeGreaterThanOrEqual(1)
    expect(losses[0].body.error.code).toBe('SCHEME_TXN_REF_REUSED')
    expect(await SchemePaymentReference.countDocuments({ normalizedReference: 'SHARED-REF' })).toBe(1)
    const paidEvents = await PaymentEvent.find({
      eventType: 'scheme_installment_paid',
      schemeInstallmentId: { $in: [idA, idB] },
    })
    expect(paidEvents).toHaveLength(1)
  })
})

describe('Phase 22.6 enrollment concurrency and ownership', () => {
  it('concurrent enroll creates exactly one active enrollment with ALREADY_ENROLLED', async () => {
    const scheme = await Scheme.create({
      name: 'Race', monthlyAmount: 40, tenureMonths: 2, bonusMonths: 0, isActive: true,
    })
    // Ensure partial unique index exists in memory (Mongoose sync)
    await SchemeEnrollment.syncIndexes()

    const results = await Promise.allSettled([
      request(app).post('/api/v1/customer/schemes/enrollments').set('Cookie', customerCookie)
        .send({ scheme_id: scheme.id }),
      request(app).post('/api/v1/customer/schemes/enrollments').set('Cookie', customerCookie)
        .send({ scheme_id: scheme.id }),
    ])
    const fulfilled = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
    const created = fulfilled.filter((r) => r.status === 201)
    const conflicts = fulfilled.filter((r) => r.status === 409)
    expect(created).toHaveLength(1)
    expect(conflicts.length).toBeGreaterThanOrEqual(1)
    expect(conflicts[0].body.error.code).toBe('ALREADY_ENROLLED')
    expect(await SchemeEnrollment.countDocuments({ customerId: customer.id, schemeId: scheme.id, status: 'active' })).toBe(1)
  })

  it('customer cannot view another customer enrollment; pagination exposes page 2', async () => {
    const scheme = await Scheme.create({
      name: 'Own', monthlyAmount: 10, tenureMonths: 1, bonusMonths: 0, isActive: true,
    })
    const mine = await schemeService.enroll(customer.id, scheme.id)
    const theirs = await schemeService.enroll(otherCustomer.id, scheme.id)

    const forbidden = await request(app)
      .get(`/api/v1/customer/schemes/enrollments/${theirs.id}`)
      .set('Cookie', customerCookie)
    expect(forbidden.status).toBe(404)

    const okMine = await request(app)
      .get(`/api/v1/customer/schemes/enrollments/${mine.id}`)
      .set('Cookie', customerCookie)
    expect(okMine.status).toBe(200)
    expect(okMine.body.data.id).toBe(String(mine.id))

    for (let i = 0; i < 3; i += 1) {
      await Scheme.create({
        name: `PagePlan${i}`, monthlyAmount: 10 + i, tenureMonths: 2, bonusMonths: 0, isActive: true,
      })
    }
    const page1 = await request(app)
      .get('/api/v1/admin/schemes')
      .set('Cookie', staffCookie)
      .query({ page: 1, limit: 2 })
    expect(page1.body.data.length).toBe(2)
    expect(page1.body.meta.pages).toBeGreaterThanOrEqual(2)
    const page2 = await request(app)
      .get('/api/v1/admin/schemes')
      .set('Cookie', staffCookie)
      .query({ page: 2, limit: 2 })
    expect(page2.body.data.length).toBeGreaterThanOrEqual(1)
    const ids1 = new Set(page1.body.data.map((s) => s.id))
    expect(page2.body.data.some((s) => !ids1.has(s.id))).toBe(true)
  })
})

describe('Phase 22.6 completion and cancellation', () => {
  it('rejects early/unpaid completion and amount field; completes exactly once', async () => {
    const scheme = await Scheme.create({
      name: 'Done', monthlyAmount: 100, tenureMonths: 2, bonusMonths: 1, isActive: true,
    })
    let enrollment = await schemeService.enroll(customer.id, scheme.id)

    const early = await request(app)
      .post(`/api/v1/admin/schemes/enrollments/${enrollment.id}/complete`)
      .set('Cookie', staffCookie)
      .send({ note: 'too early' })
    expect(early.status).toBe(409)
    expect(early.body.error.code).toBe('MATURITY_NOT_REACHED')

    for (const inst of enrollment.installments) {
      await schemeService.recordInstallment(enrollment.id, inst.id, {
        amount: inst.amount,
        payment_method: 'cash',
      }, manager.id)
    }
    enrollment = await SchemeEnrollment.findById(enrollment.id)
    await SchemeEnrollment.updateOne(
      { _id: enrollment.id },
      { $set: { maturityAt: new Date(Date.now() - 86_400_000) } },
    )

    const withAmount = await request(app)
      .post(`/api/v1/admin/schemes/enrollments/${enrollment.id}/complete`)
      .set('Cookie', staffCookie)
      .send({ note: 'Maturity verified', amount: 999 })
    expect(withAmount.status).toBe(422)

    const results = await Promise.all([
      request(app).post(`/api/v1/admin/schemes/enrollments/${enrollment.id}/complete`)
        .set('Cookie', staffCookie).send({ note: 'Maturity verified' }),
      request(app).post(`/api/v1/admin/schemes/enrollments/${enrollment.id}/complete`)
        .set('Cookie', staffCookie).send({ note: 'Maturity verified' }),
    ])
    expect(results.every((r) => r.status === 200)).toBe(true)
    const refreshed = await SchemeEnrollment.findById(enrollment.id)
    expect(refreshed.status).toBe('completed')
    expect(refreshed.payoutAmount).toBe(300)
    expect(String(refreshed.completedBy)).toBe(String(manager.id))
    expect(refreshed.statusHistory.some((h) => h.status === 'completed')).toBe(true)
    expect(await WalletTransaction.countDocuments({
      customerId: customer.id,
      type: 'scheme_payout',
    })).toBe(1)
    expect(await PaymentEvent.countDocuments({
      eventType: 'scheme_payout',
      transactionId: `scheme-payout:${enrollment.id}`,
    })).toBe(1)
  })

  it('cancellation preserves paid ledger; completed cannot cancel', async () => {
    const scheme = await Scheme.create({
      name: 'Cancel', monthlyAmount: 80, tenureMonths: 2, bonusMonths: 0, isActive: true,
    })
    let enrollment = await schemeService.enroll(customer.id, scheme.id)
    await schemeService.recordInstallment(enrollment.id, enrollment.installments[0].id, {
      amount: 80,
      payment_method: 'cash',
    }, manager.id)
    const paidEventsBefore = await PaymentEvent.countDocuments({ eventType: 'scheme_installment_paid' })

    const cancel = await request(app)
      .patch(`/api/v1/admin/schemes/enrollments/${enrollment.id}`)
      .set('Cookie', staffCookie)
      .send({ status: 'cancelled', reason: 'Customer requested cancellation' })
    expect(cancel.status).toBe(200)
    enrollment = await SchemeEnrollment.findById(enrollment.id)
    expect(enrollment.status).toBe('cancelled')
    expect(enrollment.installments[0].paymentStatus).toBe('paid')
    expect(enrollment.installments[1].paymentStatus).toBe('cancelled')
    expect(await PaymentEvent.countDocuments({ eventType: 'scheme_installment_paid' })).toBe(paidEventsBefore)

    // Completed cannot cancel
    const scheme2 = await Scheme.create({
      name: 'Done2', monthlyAmount: 10, tenureMonths: 1, bonusMonths: 0, isActive: true,
    })
    let done = await schemeService.enroll(customer.id, scheme2.id)
    await schemeService.recordInstallment(done.id, done.installments[0].id, {
      amount: 10, payment_method: 'cash',
    }, manager.id)
    await SchemeEnrollment.updateOne({ _id: done.id }, {
      $set: { maturityAt: new Date(Date.now() - 1000), status: 'completed', completedAt: new Date(), payoutAmount: 10 },
    })
    const refuse = await request(app)
      .patch(`/api/v1/admin/schemes/enrollments/${done.id}`)
      .set('Cookie', staffCookie)
      .send({ status: 'cancelled', reason: 'nope' })
    expect(refuse.status).toBe(409)
    expect(refuse.body.error.code).toBe('CANNOT_CANCEL_COMPLETED')
  })
})
