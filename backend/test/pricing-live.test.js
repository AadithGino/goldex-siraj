import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Brand, Category, Product, ProductStone, TaxSetting, Variant } from '../src/models/catalog.models.js'
import { GoldRate, StoneRate } from '../src/models/rate.models.js'
import { getPriceBreakup } from '../src/services/pricing.service.js'

let mongo

beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongo) await mongo.stop()
})

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})))
  await TaxSetting.create({ singleton: 'default', isActive: true, taxPercent: 5, taxMode: 'exclusive', applyOn: 'total' })
  await GoldRate.create({ purity: '22k', ratePerGram: 200, isCurrent: true, effectiveAt: new Date() })
})

async function seedProduct({ status = 'active', withStone = true } = {}) {
  const brand = await Brand.create({ name: 'G', slug: `g-${Date.now()}`, isActive: true })
  const category = await Category.create({ name: 'R', slug: `r-${Date.now()}`, isActive: true })
  const product = await Product.create({
    name: 'Ring',
    slug: `ring-${Date.now()}`,
    brandId: brand.id,
    categoryId: category.id,
    status,
    metalType: 'gold',
    purity: '22k',
    wastagePercent: 0,
    makingChargeType: 'flat',
    makingChargeValue: 0,
    taxTreatment: 'standard',
  })
  const variant = await Variant.create({
    productId: product.id,
    sku: `SKU-${Date.now()}`,
    label: '16',
    weightGrams: 4,
    effectiveWeight: 4,
    stockQty: 5,
    purity: '22k',
    isActive: true,
    stoneCharge: 0,
  })
  if (withStone) {
    const historical = await StoneRate.create({
      stoneType: 'diamond',
      grade: 'VS',
      unit: 'carat',
      rate: 500,
      isCurrent: false,
      effectiveAt: new Date(Date.now() - 86_400_000),
    })
    await ProductStone.create({
      variantId: variant.id,
      stoneType: 'diamond',
      grade: 'VS',
      unit: 'carat',
      stoneCount: 1,
      weight: 0.5,
      pricingMode: 'rate',
      stoneRateId: historical.id,
    })
    await StoneRate.create({
      stoneType: 'diamond',
      grade: 'VS',
      unit: 'carat',
      rate: 1200,
      isCurrent: true,
      effectiveAt: new Date(),
    })
  }
  return { product, variant }
}

describe('live getPriceBreakup', () => {
  it('loads ProductStone + current StoneRate and ignores historical stoneRateId', async () => {
    const { variant } = await seedProduct()
    const breakup = await getPriceBreakup(variant.id, 1)
    expect(breakup.stone_breakup).toHaveLength(1)
    expect(breakup.stone_charge).toBe(600)
    expect(breakup.gold_value).toBe(800)
    expect(breakup.total).toBe(1470) // (800+600)*1.05
  })

  it('rejects missing current stone rate while keeping historical reference', async () => {
    const { variant } = await seedProduct({ withStone: true })
    await StoneRate.deleteMany({ isCurrent: true })
    await expect(getPriceBreakup(variant.id, 1)).rejects.toMatchObject({ code: 'STONE_RATE_MISSING' })
  })

  it('rejects orphan stone_rate_id', async () => {
    const { variant } = await seedProduct({ withStone: true })
    const stone = await ProductStone.findOne({ variantId: variant.id })
    await StoneRate.deleteOne({ _id: stone.stoneRateId })
    await expect(getPriceBreakup(variant.id, 1)).rejects.toMatchObject({ code: 'STONE_RATE_ORPHAN' })
  })

  it('fixed/manual stones use saved manual_charge', async () => {
    const { variant } = await seedProduct({ withStone: false })
    await ProductStone.create({
      variantId: variant.id,
      stoneType: 'pearl',
      label: 'White Pearl',
      unit: 'piece',
      stoneCount: 2,
      pricingMode: 'fixed',
      manualCharge: 175,
      shape: 'Round',
      sizeMm: 5,
      settingType: 'Cap',
    })
    const breakup = await getPriceBreakup(variant.id, 1)
    expect(breakup.stone_breakup).toHaveLength(1)
    expect(breakup.stone_breakup[0].pricing_mode).toBe('fixed')
    expect(breakup.stone_breakup[0].amount).toBe(175)
    expect(breakup.stone_breakup[0].rate_id).toBeNull()
    expect(breakup.stone_charge).toBe(175)
  })

  it('rejects draft products even when the ID is guessed', async () => {
    const { variant } = await seedProduct({ status: 'draft', withStone: false })
    await expect(getPriceBreakup(variant.id, 1)).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' })
  })

  it('rejects archived products', async () => {
    const { variant } = await seedProduct({ status: 'archived', withStone: false })
    await expect(getPriceBreakup(variant.id, 1)).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' })
  })

  it('uses updated live stone rates for COD-style ignoreFixedPrice calls', async () => {
    const { variant } = await seedProduct()
    await Variant.updateOne({ _id: variant.id }, { $set: { fixedPrice: 50 } })
    const before = await getPriceBreakup(variant.id, 1, null, { ignoreFixedPrice: true })
    await StoneRate.updateOne({ stoneType: 'diamond', isCurrent: true }, { $set: { rate: 2000 } })
    const after = await getPriceBreakup(variant.id, 1, null, { ignoreFixedPrice: true })
    expect(before.stone_charge).toBe(600)
    expect(after.stone_charge).toBe(1000)
    expect(after.total).toBeGreaterThan(before.total)
  })
})
