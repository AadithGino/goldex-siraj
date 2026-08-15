import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Customer, Staff } from '../src/models/auth.models.js'
import { StoreSetting, TaxSetting } from '../src/models/catalog.models.js'
import { CustomJewelleryRequest } from '../src/models/commerce.models.js'
import { GoldRate } from '../src/models/rate.models.js'
import { hashPassword } from '../src/services/auth.service.js'
import {
  acceptQuote,
  cancelRequest,
  completeRequest,
  computeCustomQuote,
  createRequest,
  declineQuote,
  declineRequest,
  quoteRequest,
} from '../src/services/custom-request.service.js'

let mongoServer
let customer
let staff

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-custom-request'))
  await CustomJewelleryRequest.syncIndexes()
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})))
  await StoreSetting.create({ singleton: 'default', storeName: 'Goldex' })
  await TaxSetting.create({ singleton: 'default', isActive: true, taxPercent: 5, taxMode: 'exclusive', applyOn: 'total' })
  await GoldRate.create({ purity: '22k', ratePerGram: 250, isCurrent: true, effectiveAt: new Date() })
  customer = await Customer.create({ phone: '+971501000777', fullName: 'Custom User', authProvider: 'otp' })
  staff = await Staff.create({
    fullName: 'Quote Manager',
    email: 'custom@example.com',
    passwordHash: await hashPassword('password-12345678'),
    role: 'manager',
  })
})

function payload(overrides = {}) {
  return {
    jewellery_type: 'ring',
    purity: '22k',
    metal_color: 'yellow',
    gold_weight_grams: 8,
    size_label: '16',
    description: 'Floral cluster ring inspired by the attached sketch.',
    image_keys: ['private/custom-jewellery-images/2026-08-14/ref.jpg'],
    ...overrides,
  }
}

describe('computeCustomQuote', () => {
  it('applies percent making, wastage, stone and exclusive VAT', () => {
    const quote = computeCustomQuote({
      goldWeightGrams: 10,
      goldRatePerGram: 200,
      makingChargeType: 'percent',
      makingChargeValue: 10,
      wastagePercent: 5,
      stoneCharge: 100,
      tax: { isActive: true, taxPercent: 5, taxMode: 'exclusive', applyOn: 'total' },
    })
    expect(quote.goldValue).toBe(2000)
    expect(quote.wastageAmount).toBe(100)
    expect(quote.makingCharge).toBe(200)
    expect(quote.subtotal).toBe(2400)
    expect(quote.vatAmount).toBe(120)
    expect(quote.total).toBe(2520)
  })
})

describe('custom jewellery request flow', () => {
  it('creates, quotes, and lets the customer accept', async () => {
    const created = await createRequest(customer.id, payload())
    expect(created.status).toBe('submitted')
    expect(created.requestNumber).toMatch(/^CJ-\d{4}-\d{5}$/)

    const quoted = await quoteRequest(created.id, {
      making_charge_type: 'percent',
      making_charge_value: 12,
      wastage_percent: 4,
      stone_charge: 50,
      admin_notes: 'Includes setting of 8 stones.',
      valid_days: 7,
    }, staff.id)

    expect(quoted.status).toBe('quoted')
    expect(quoted.quote.gold_value || quoted.quote.goldValue).toBeTruthy()
    const goldValue = quoted.quote.goldValue ?? quoted.quote.gold_value
    expect(goldValue).toBe(2000)

    const accepted = await acceptQuote(customer.id, created.id)
    expect(accepted.status).toBe('accepted')

    const completed = await completeRequest(created.id, { note: 'Piece ready for pickup' }, staff.id)
    expect(completed.status).toBe('completed')
  })

  it('lets the customer cancel a submitted request and decline a quote', async () => {
    const first = await createRequest(customer.id, payload())
    const cancelled = await cancelRequest(customer.id, first.id)
    expect(cancelled.status).toBe('cancelled')

    const second = await createRequest(customer.id, payload({ description: 'Second design with extra floral work.' }))
    await quoteRequest(second.id, {
      making_charge_type: 'flat',
      making_charge_value: 400,
      wastage_percent: 3,
      stone_charge: 0,
    }, staff.id)
    const declined = await declineQuote(customer.id, second.id, 'Too expensive')
    expect(declined.status).toBe('declined')
    expect(declined.declinedBy).toBe('customer')
  })

  it('lets staff decline a submitted request', async () => {
    const created = await createRequest(customer.id, payload())
    const declined = await declineRequest(created.id, { reason: 'Cannot source this design' }, staff.id)
    expect(declined.status).toBe('declined')
  })

  it('caps open requests per customer', async () => {
    for (let i = 0; i < 5; i += 1) {
      await createRequest(customer.id, payload({ description: `Design sketch number ${i + 1} with extra detail.` }))
    }
    await expect(createRequest(customer.id, payload({ description: 'One more floral ring design please.' })))
      .rejects.toMatchObject({ code: 'TOO_MANY_OPEN_REQUESTS' })
  })
})
