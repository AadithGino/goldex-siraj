import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { serialize } from '../src/utils/serialize.js'
import { Staff } from '../src/models/auth.models.js'
import { GoldRate, StoneRate } from '../src/models/rate.models.js'
import { hashPassword } from '../src/services/auth.service.js'
import * as rateService from '../src/services/rate.service.js'

let mongoServer

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri('goldex-rates-test'))
}, 60_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  const collections = mongoose.connection.collections
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})))
})

describe('rate list API contract', () => {
  it('serializes gold and stone rates with effective_at (not effective_date)', async () => {
    const staff = await Staff.create({
      fullName: 'Rate Owner',
      email: 'rates@example.com',
      passwordHash: await hashPassword('password-12345678'),
      role: 'owner',
    })

    await GoldRate.create({
      purity: '22k',
      ratePerGram: 250,
      effectiveAt: new Date('2026-07-20T10:00:00.000Z'),
      isCurrent: true,
      createdBy: staff.id,
    })
    await StoneRate.create({
      stoneType: 'diamond',
      grade: 'VS',
      unit: 'carat',
      rate: 1200,
      effectiveAt: new Date('2026-07-18T08:00:00.000Z'),
      isCurrent: true,
      createdBy: staff.id,
    })

    const gold = serialize(await rateService.listGoldRates())
    const stone = serialize(await rateService.listStoneRates())

    expect(gold[0]).toMatchObject({
      purity: '22k',
      rate_per_gram: 250,
      is_current: true,
      effective_at: '2026-07-20T10:00:00.000Z',
      created_by: {
        id: String(staff.id),
        full_name: 'Rate Owner',
        email: 'rates@example.com',
        role: 'owner',
      },
    })
    expect(gold[0]).not.toHaveProperty('effective_date')

    expect(stone[0]).toMatchObject({
      stone_type: 'diamond',
      grade: 'VS',
      unit: 'carat',
      rate: 1200,
      is_current: true,
      effective_at: '2026-07-18T08:00:00.000Z',
      created_by: {
        full_name: 'Rate Owner',
        email: 'rates@example.com',
      },
    })
    expect(stone[0]).not.toHaveProperty('effective_date')
  })

  it('keeps rates without effectiveAt and sorts by createdAt fallback', async () => {
    await GoldRate.collection.insertMany([
      {
        purity: '18k',
        ratePerGram: 180,
        isCurrent: false,
        effectiveAt: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      },
      {
        purity: '18k',
        ratePerGram: 190,
        effectiveAt: new Date('2026-07-10T00:00:00.000Z'),
        isCurrent: true,
        createdAt: new Date('2026-07-10T00:00:00.000Z'),
      },
    ])

    const rows = serialize(await rateService.listGoldRates())
    expect(rows).toHaveLength(2)
    expect(rows[0].rate_per_gram).toBe(190)
    expect(rows[0].effective_at).toBe('2026-07-10T00:00:00.000Z')
    expect(rows[1].rate_per_gram).toBe(180)
    expect(rows[1].effective_at).toBeNull()
    expect(rows[1]).not.toHaveProperty('effective_date')
  })
})
