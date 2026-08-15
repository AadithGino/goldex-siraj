import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Customer, Staff } from '../src/models/auth.models.js'
import { SellJewelleryRequest } from '../src/models/commerce.models.js'
import { GoldBuybackRate } from '../src/models/rate.models.js'
import { hashPassword } from '../src/services/auth.service.js'
import {
  acceptOffer,
  cancelRequest,
  completeRequest,
  computeSellOffer,
  createRequest,
  declineOffer,
  declineRequest,
  offerRequest,
  replyToRequest,
  requestMoreInfo,
} from '../src/services/sell-request.service.js'

let mongoServer
let customer
let staff

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-sell-request'))
  await SellJewelleryRequest.syncIndexes()
  await GoldBuybackRate.syncIndexes()
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})))
  await GoldBuybackRate.create({ purity: '22k', ratePerGram: 230, isCurrent: true, effectiveAt: new Date() })
  customer = await Customer.create({ phone: '+971501000888', fullName: 'Sell User', authProvider: 'otp' })
  staff = await Staff.create({
    fullName: 'Buyback Manager',
    email: 'sell@example.com',
    passwordHash: await hashPassword('password-12345678'),
    role: 'manager',
  })
})

function payload(overrides = {}) {
  return {
    jewellery_type: 'necklace',
    purity: '22k',
    net_weight_grams: 10,
    notes: 'Family necklace, hallmarked, no stones.',
    image_keys: ['private/sell-jewellery-images/2026-08-14/piece.jpg'],
    pickup_address: {
      recipient_name: 'Sell User',
      phone: '501000888',
      line1: 'Villa 12, Al Wasl Road',
      city: 'Jumeirah',
      state: 'Dubai',
      pincode: '',
      country: 'United Arab Emirates',
      latitude: 25.2048,
      longitude: 55.2708,
    },
    ...overrides,
  }
}

describe('computeSellOffer', () => {
  it('multiplies net weight by the buyback rate', () => {
    const offer = computeSellOffer({ netWeightGrams: 10, ratePerGram: 230 })
    expect(offer.amount).toBe(2300)
    expect(offer.netWeightGrams).toBe(10)
    expect(offer.ratePerGram).toBe(230)
  })
})

describe('sell jewellery request flow', () => {
  it('snapshots the indicative payout and lets admin offer then complete', async () => {
    const created = await createRequest(customer.id, payload())
    expect(created.status).toBe('submitted')
    expect(created.requestNumber).toMatch(/^SG-\d{4}-\d{5}$/)
    expect(created.indicative.amount).toBe(2300)
    expect(created.invoice).toBeNull()
    expect(created.pickupAddress.latitude).toBe(25.2048)

    const offered = await offerRequest(created.id, {
      net_weight_grams: 9.8,
      rate_per_gram: 228,
      admin_notes: 'After inspection, net gold is 9.8 g.',
      valid_days: 7,
    }, staff.id)
    expect(offered.status).toBe('offered')
    expect(offered.offer.amount).toBe(2234.4)

    const accepted = await acceptOffer(customer.id, created.id)
    expect(accepted.status).toBe('accepted')

    const completed = await completeRequest(created.id, { note: 'Collected and paid' }, staff.id)
    expect(completed.status).toBe('completed')
  })

  it('stores an optional invoice and uses live buyback rate when admin omits rate', async () => {
    const created = await createRequest(customer.id, payload({
      invoice_key: 'private/sell-invoice-files/2026-08-14/bill.pdf',
    }))
    expect(created.invoice.key).toBe('private/sell-invoice-files/2026-08-14/bill.pdf')

    const offered = await offerRequest(created.id, { admin_notes: 'As declared' }, staff.id)
    expect(offered.offer.ratePerGram ?? offered.offer.rate_per_gram).toBe(230)
    expect(offered.offer.amount).toBe(2300)
  })

  it('lets admin request more details and the customer reply', async () => {
    const created = await createRequest(customer.id, payload())
    const asked = await requestMoreInfo(created.id, { message: 'Please add a close-up of the hallmark.' }, staff.id)
    expect(asked.status).toBe('needs_info')
    expect(asked.messages).toHaveLength(1)

    const replied = await replyToRequest(customer.id, created.id, {
      message: 'Added a hallmark photo.',
      image_keys: ['private/sell-jewellery-images/2026-08-14/hallmark.jpg'],
    })
    expect(replied.status).toBe('submitted')
    expect(replied.images).toHaveLength(2)
    expect(replied.messages).toHaveLength(2)
  })

  it('lets the customer cancel a submitted request and decline an offer', async () => {
    const first = await createRequest(customer.id, payload())
    const cancelled = await cancelRequest(customer.id, first.id)
    expect(cancelled.status).toBe('cancelled')

    const second = await createRequest(customer.id, payload({ notes: 'Second piece, plain bangle.' }))
    await offerRequest(second.id, { valid_days: 3 }, staff.id)
    const declined = await declineOffer(customer.id, second.id, 'Need a higher rate')
    expect(declined.status).toBe('declined')
    expect(declined.declinedBy).toBe('customer')
  })

  it('lets staff decline a submitted request', async () => {
    const created = await createRequest(customer.id, payload())
    const declined = await declineRequest(created.id, { reason: 'Not gold' }, staff.id)
    expect(declined.status).toBe('declined')
  })

  it('requires a current buyback rate to submit', async () => {
    await GoldBuybackRate.deleteMany({})
    await expect(createRequest(customer.id, payload())).rejects.toMatchObject({ code: 'GOLD_BUYBACK_RATE_MISSING' })
  })

  it('caps open requests per customer', async () => {
    for (let i = 0; i < 5; i += 1) {
      await createRequest(customer.id, payload({ notes: `Piece number ${i + 1} for evaluation.` }))
    }
    await expect(createRequest(customer.id, payload({ notes: 'One more necklace for evaluation.' })))
      .rejects.toMatchObject({ code: 'TOO_MANY_OPEN_REQUESTS' })
  })
})
