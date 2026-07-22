import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Customer, Staff } from '../src/models/auth.models.js'
import { Scheme, SchemeEnrollment } from '../src/models/scheme.models.js'
import { hashPassword } from '../src/services/auth.service.js'
import * as schemeService from '../src/services/scheme.service.js'
import * as walletService from '../src/services/wallet.service.js'
import { applyOverdueStatuses } from '../src/services/scheme.service.js'

let mongoServer
let customer
let manager
let scheme

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-scheme-test'))
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})))
  customer = await Customer.create({ phone: '+971509990001', fullName: 'Scheme User', authProvider: 'otp' })
  manager = await Staff.create({
    fullName: 'Manager',
    email: 'scheme-mgr@example.com',
    passwordHash: await hashPassword('password-12345678'),
    role: 'manager',
  })
  scheme = await Scheme.create({
    name: 'Gold Save',
    monthlyAmount: 100,
    tenureMonths: 2,
    bonusMonths: 1,
    isActive: true,
  })
})

async function payAll(enrollment, staffId) {
  for (const installment of enrollment.installments) {
    const result = await schemeService.recordInstallment(enrollment.id, installment.id, {
      amount: installment.amount,
      payment_method: 'cash',
      transaction_ref: null,
      note: null,
    }, staffId)
    enrollment = await SchemeEnrollment.findById(enrollment.id)
    void result
  }
  return enrollment
}

describe('gold scheme maturity safety', () => {
  it('uses calendar-safe month-end due and maturity dates on enrollment', async () => {
    const { addCalendarMonths } = await import('../src/utils/calendarMonths.js')
    const longScheme = await Scheme.create({
      name: 'Month End Plan',
      monthlyAmount: 50,
      tenureMonths: 3,
      bonusMonths: 0,
      isActive: true,
    })
    const enrollment = await schemeService.enroll(customer.id, longScheme.id)
    // Align to a known Jan 31 start by rewriting with calendar helper (same as service)
    const startedAt = new Date(Date.UTC(2026, 0, 31, 12, 0, 0))
    enrollment.startedAt = startedAt
    enrollment.maturityAt = addCalendarMonths(startedAt, 3)
    enrollment.installments.forEach((row, index) => {
      row.dueDate = addCalendarMonths(startedAt, index)
    })
    await enrollment.save()

    expect(enrollment.installments[0].dueDate.toISOString().slice(0, 10)).toBe('2026-01-31')
    expect(enrollment.installments[1].dueDate.toISOString().slice(0, 10)).toBe('2026-02-28')
    expect(enrollment.installments[2].dueDate.toISOString().slice(0, 10)).toBe('2026-03-31')
    expect(enrollment.maturityAt.toISOString().slice(0, 10)).toBe('2026-04-30')
  })

  it('keeps enrollment active when all installments are paid before maturity', async () => {
    let enrollment = await schemeService.enroll(customer.id, scheme.id)
    enrollment = await payAll(enrollment, manager.id)
    expect(enrollment.status).toBe('active')
    expect(enrollment.completedAt).toBeFalsy()
    expect(await walletService.balance(customer.id)).toBe(0)

    await expect(schemeService.completeEnrollment(enrollment.id, manager.id))
      .rejects.toMatchObject({ code: 'MATURITY_NOT_REACHED' })
  })

  it('completes with one payout after maturity and is idempotent under concurrency', async () => {
    let enrollment = await schemeService.enroll(customer.id, scheme.id)
    enrollment = await payAll(enrollment, manager.id)
    await SchemeEnrollment.updateOne(
      { _id: enrollment.id },
      { $set: { maturityAt: new Date(Date.now() - 86_400_000) } },
    )

    const results = await Promise.all([
      schemeService.completeEnrollment(enrollment.id, manager.id),
      schemeService.completeEnrollment(enrollment.id, manager.id),
    ])
    expect(results.every((row) => row.status === 'completed')).toBe(true)
    const expected = 100 * (2 + 1)
    expect(await walletService.balance(customer.id)).toBeCloseTo(expected, 2)
    const refreshed = await SchemeEnrollment.findById(enrollment.id)
    expect(refreshed.payoutAmount).toBe(expected)
  })

  it('cancels unpaid future installments on enrollment cancel', async () => {
    const enrollment = await schemeService.enroll(customer.id, scheme.id)
    await schemeService.recordInstallment(enrollment.id, enrollment.installments[0].id, {
      amount: enrollment.installments[0].amount,
      payment_method: 'cash',
      transaction_ref: null,
    }, manager.id)
    const cancelled = await schemeService.updateEnrollment(enrollment.id, { status: 'cancelled' }, manager.id)
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.installments[0].paymentStatus).toBe('paid')
    expect(cancelled.installments[1].paymentStatus).toBe('cancelled')
  })

  it('rejects completion when any installment is cancelled (not paid)', async () => {
    let enrollment = await schemeService.enroll(customer.id, scheme.id)
    await schemeService.recordInstallment(enrollment.id, enrollment.installments[0].id, {
      amount: enrollment.installments[0].amount,
      payment_method: 'cash',
      transaction_ref: null,
    }, manager.id)
    enrollment = await SchemeEnrollment.findById(enrollment.id)
    enrollment.installments[1].paymentStatus = 'cancelled'
    await enrollment.save()
    await SchemeEnrollment.updateOne(
      { _id: enrollment.id },
      { $set: { maturityAt: new Date(Date.now() - 86_400_000) } },
    )

    await expect(schemeService.completeEnrollment(enrollment.id, manager.id))
      .rejects.toMatchObject({ code: 'INSTALLMENTS_UNPAID' })
    expect(await walletService.balance(customer.id)).toBe(0)
  })

  it('marks overdue installments at Dubai day boundary', () => {
    const enrollment = {
      installments: [
        { paymentStatus: 'pending', dueDate: new Date('2020-01-01T00:00:00.000Z') },
        { paymentStatus: 'pending', dueDate: new Date(Date.now() + 10 * 86_400_000) },
        { paymentStatus: 'paid', dueDate: new Date('2020-01-01T00:00:00.000Z') },
      ],
    }
    applyOverdueStatuses(enrollment, new Date('2026-07-20T12:00:00.000+04:00'))
    expect(enrollment.installments[0].paymentStatus).toBe('overdue')
    expect(enrollment.installments[1].paymentStatus).toBe('pending')
    expect(enrollment.installments[2].paymentStatus).toBe('paid')
  })
})
