/**
 * Phase 22.8 — Variant, stone pricing, and inventory contract closure.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import app from '../src/app.js'
import { Staff } from '../src/models/auth.models.js'
import {
  Brand,
  Category,
  Product,
  ProductStone,
  StoreSetting,
  TaxSetting,
  Variant,
} from '../src/models/catalog.models.js'
import { GoldRate, StoneRate, StockMovement } from '../src/models/rate.models.js'
import { Order } from '../src/models/commerce.models.js'
import { hashPassword, issueSession } from '../src/services/auth.service.js'
import * as catalogService from '../src/services/catalog.service.js'
import * as adminService from '../src/services/admin.service.js'
import { getPriceBreakup } from '../src/services/pricing.service.js'
import { adjustStock, setStock } from '../src/services/inventory.service.js'
import { serialize } from '../src/utils/serialize.js'
import { stoneSchema, createVariantCompleteSchema } from '../src/validators/catalog.validators.js'
import { setStockSchema } from '../src/validators/order.validators.js'
import { SESSION_COOKIES } from '../src/utils/sessionCookies.js'

let mongoServer
let staff
let staffCookie
let brand
let category
let product
let pieceRate
let caratRate

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
}

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-phase-228'))
  await Variant.syncIndexes()
  await StockMovement.syncIndexes()
  await ProductStone.syncIndexes()
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})))
  staff = await Staff.create({
    fullName: 'Ops',
    email: 'phase228@example.com',
    passwordHash: await hashPassword('password-12345678'),
    role: 'manager',
    isActive: true,
  })
  const session = await issueSession(staff, 'staff')
  staffCookie = cookieHeader({
    [SESSION_COOKIES.staffAccess]: session.accessToken,
    [SESSION_COOKIES.staffRefresh]: session.refreshToken,
  })

  await StoreSetting.create({ singleton: 'default', currency: 'AED', shippingFee: 0 })
  await TaxSetting.create({ singleton: 'default', isActive: true, taxPercent: 5, taxMode: 'exclusive', applyOn: 'total' })
  await GoldRate.create({ purity: '22k', ratePerGram: 200, isCurrent: true, effectiveAt: new Date() })
  await GoldRate.create({ purity: '24k', ratePerGram: 250, isCurrent: true, effectiveAt: new Date() })
  await GoldRate.create({ purity: '21k', ratePerGram: 190, isCurrent: true, effectiveAt: new Date() })

  brand = await Brand.create({ name: 'B228', slug: 'b228', isActive: true })
  category = await Category.create({ name: 'C228', slug: 'c228', isActive: true })
  product = await Product.create({
    name: 'Needle Inventory Product',
    slug: 'needle-inventory-product',
    brandId: brand.id,
    categoryId: category.id,
    status: 'active',
    metalType: 'gold',
    purity: '22k',
    makingChargeType: 'flat',
    makingChargeValue: 0,
    wastagePercent: 0,
    taxTreatment: 'standard',
  })
  pieceRate = await StoneRate.create({
    stoneType: 'ruby',
    grade: 'AA',
    unit: 'piece',
    rate: 40,
    isCurrent: true,
    effectiveAt: new Date(),
  })
  caratRate = await StoneRate.create({
    stoneType: 'diamond',
    grade: 'VS',
    unit: 'carat',
    rate: 1000,
    isCurrent: true,
    effectiveAt: new Date(),
  })
})

describe('Phase 22.8 stone schema validation', () => {
  it('rejects unknown fields and conflicting aliases', () => {
    expect(() => stoneSchema.parse({ pricing_mode: 'fixed', stone_type: 'x', stone_count: 1, manual_charge: 1, charge: 9 })).toThrow()
    const conflict = stoneSchema.safeParse({
      pricing_mode: 'fixed',
      pricingMode: 'rate',
      stone_type: 'x',
      stone_count: 1,
      manual_charge: 1,
    })
    expect(conflict.success).toBe(false)
  })

  it('rejects blank numeric input (does not coerce to zero)', () => {
    const blank = stoneSchema.safeParse({
      pricing_mode: 'fixed',
      stone_type: 'x',
      stone_count: '',
      manual_charge: 10,
      unit: 'piece',
    })
    expect(blank.success).toBe(false)
  })

  it('requires carat weight and piece count', () => {
    expect(stoneSchema.safeParse({
      pricing_mode: 'rate',
      stone_rate_id: caratRate.id,
      unit: 'carat',
      stone_count: 1,
    }).success).toBe(false)
    expect(stoneSchema.safeParse({
      pricing_mode: 'fixed',
      stone_type: 'pearl',
      unit: 'piece',
      manual_charge: 10,
    }).success).toBe(false)
  })
})

describe('Phase 22.8 stone create/read/edit round trips', () => {
  it('rate-linked stone persists display attrs and canonical rate fields', async () => {
    const created = await catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'ST-RATE-1',
      label: 'Rate',
      purity: '22k',
      weight_grams: 4,
      effective_weight: 4,
      stock_qty: 0,
      idempotency_key: 'stone-rate-create-1',
      product_stones: [{
        pricing_mode: 'rate',
        stone_rate_id: pieceRate.id,
        label: 'Ruby AA',
        stone_type: 'ruby',
        grade: 'AA',
        unit: 'piece',
        stone_count: 3,
        shape: 'Oval',
        size_mm: 4.5,
        setting_type: 'Prong',
      }],
    }, staff.id)

    const stone = created.product_stones[0]
    expect(stone.pricingMode || stone.pricing_mode).toBe('rate')
    expect(String(stone.stoneRateId || stone.stone_rate_id)).toBe(String(pieceRate.id))
    expect(stone.stoneType || stone.stone_type).toBe('ruby')
    expect(stone.shape).toBe('Oval')
    expect(Number(stone.sizeMm ?? stone.size_mm)).toBe(4.5)
    expect(stone.settingType || stone.setting_type).toBe('Prong')

    const updated = await catalogService.updateVariantComplete(created._id || created.id, {
      idempotency_key: 'stone-rate-update-1',
      product_stones: [{
        pricing_mode: 'rate',
        stone_rate_id: pieceRate.id,
        label: 'Ruby AA edit',
        stone_type: 'ruby',
        grade: 'AA',
        unit: 'piece',
        stone_count: 4,
        shape: 'Round',
        size_mm: 5,
        setting_type: 'Bezel',
      }],
    }, staff.id)
    const again = updated.product_stones[0]
    expect(again.label).toBe('Ruby AA edit')
    expect(again.shape).toBe('Round')
    expect(Number(again.sizeMm ?? again.size_mm)).toBe(5)
    expect(again.settingType || again.setting_type).toBe('Bezel')
    expect(Number(again.stoneCount ?? again.stone_count)).toBe(4)
  })

  it('fixed/manual stone round trip preserves manual_charge and attrs', async () => {
    const created = await catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'ST-FIX-1',
      label: 'Fixed',
      purity: '22k',
      weight_grams: 3,
      effective_weight: 3,
      stock_qty: 0,
      idempotency_key: 'stone-fix-create-1',
      product_stones: [{
        pricing_mode: 'fixed',
        stone_type: 'pearl',
        label: 'White Pearl',
        unit: 'piece',
        stone_count: 2,
        manual_charge: 88,
        shape: 'Round',
        size_mm: 6,
        setting_type: 'Cap',
      }],
    }, staff.id)
    const stone = created.product_stones[0]
    expect(stone.pricingMode).toBe('fixed')
    expect(stone.manualCharge).toBe(88)
    expect(stone.stoneRateId).toBeFalsy()
    expect(stone.shape).toBe('Round')

    const updated = await catalogService.updateVariantComplete(created._id || created.id, {
      idempotency_key: 'stone-fix-update-1',
      product_stones: [{
        pricing_mode: 'fixed',
        stone_type: 'pearl',
        label: 'White Pearl',
        unit: 'piece',
        stone_count: 2,
        manual_charge: 99,
        shape: 'Baroque',
        size_mm: 7,
        setting_type: 'Glue',
      }],
    }, staff.id)
    expect(updated.product_stones[0].manualCharge).toBe(99)
    expect(updated.product_stones[0].shape).toBe('Baroque')
    expect(updated.product_stones[0].settingType).toBe('Glue')
  })

  it('selected rate canonical type/grade/unit are authoritative', async () => {
    await expect(catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'ST-MISMATCH',
      label: 'x',
      purity: '22k',
      weight_grams: 2,
      effective_weight: 2,
      stock_qty: 0,
      idempotency_key: 'stone-mismatch-1',
      product_stones: [{
        pricing_mode: 'rate',
        stone_rate_id: pieceRate.id,
        stone_type: 'diamond',
        grade: 'VS',
        unit: 'piece',
        stone_count: 1,
      }],
    }, staff.id)).rejects.toMatchObject({ code: 'STONE_RATE_MISMATCH' })
  })

  it('rejects orphan / invalid StoneRate on write', async () => {
    await expect(catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'ST-ORPHAN',
      label: 'x',
      purity: '22k',
      weight_grams: 2,
      effective_weight: 2,
      stock_qty: 0,
      idempotency_key: 'stone-orphan-1',
      product_stones: [{
        pricing_mode: 'rate',
        stone_rate_id: new mongoose.Types.ObjectId().toString(),
        stone_type: 'ruby',
        unit: 'piece',
        stone_count: 1,
      }],
    }, staff.id)).rejects.toMatchObject({ code: 'STONE_RATE_NOT_FOUND' })
  })

  it('rejects carat without weight and piece without count via service', async () => {
    await expect(catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'ST-CARAT-BAD',
      label: 'x',
      purity: '22k',
      weight_grams: 2,
      effective_weight: 2,
      stock_qty: 0,
      idempotency_key: 'stone-carat-bad',
      product_stones: [{
        pricing_mode: 'rate',
        stone_rate_id: caratRate.id,
        stone_type: 'diamond',
        grade: 'VS',
        unit: 'carat',
        stone_count: 1,
      }],
    }, staff.id)).rejects.toMatchObject({ code: 'INVALID_STONE_WEIGHT' })
  })
})

describe('Phase 22.8 variant purity and tax', () => {
  it('supports 21K and forces 24K to zero_rated', async () => {
    const v21 = await catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'P21',
      label: '21K',
      purity: '21K',
      weight_grams: 3,
      effective_weight: 3,
      stock_qty: 0,
      idempotency_key: 'purity-21k',
    }, staff.id)
    expect(v21.purity).toBe('21k')

    const v24 = await catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'P24',
      label: '24K',
      purity: '24K',
      weight_grams: 3,
      effective_weight: 3,
      tax_treatment: 'standard',
      stock_qty: 0,
      idempotency_key: 'purity-24k',
    }, staff.id)
    expect(v24.purity).toBe('24k')
    expect(v24.taxTreatment).toBe('zero_rated')
  })

  it('rejects reserved metadata keys from clients', async () => {
    await expect(catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'META-BAD',
      label: 'x',
      purity: '22k',
      weight_grams: 2,
      effective_weight: 2,
      stock_qty: 0,
      idempotency_key: 'meta-reserved-1',
      metadata: { idempotencyKey: 'hack' },
    }, staff.id)).rejects.toMatchObject({ code: 'RESERVED_METADATA' })
  })
})

describe('Phase 22.8 authoritative stone quotes', () => {
  it('rate-linked quote uses current rate; fixed uses manual charge', async () => {
    const rateVariant = await catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'Q-RATE',
      label: 'q',
      purity: '22k',
      weight_grams: 4,
      effective_weight: 4,
      stock_qty: 1,
      stock_idempotency_key: 'q-rate:stock',
      idempotency_key: 'q-rate',
      product_stones: [{
        pricing_mode: 'rate',
        stone_rate_id: caratRate.id,
        stone_type: 'diamond',
        grade: 'VS',
        unit: 'carat',
        stone_count: 1,
        weight: 0.5,
      }],
    }, staff.id)
    const rateBreakup = await getPriceBreakup(rateVariant._id || rateVariant.id, 1)
    expect(rateBreakup.stone_charge).toBe(500)
    expect(rateBreakup.stone_breakup[0].pricing_mode).toBe('rate')

    const fixedVariant = await catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'Q-FIX',
      label: 'q',
      purity: '22k',
      weight_grams: 4,
      effective_weight: 4,
      stock_qty: 0,
      idempotency_key: 'q-fix',
      product_stones: [{
        pricing_mode: 'fixed',
        stone_type: 'pearl',
        unit: 'piece',
        stone_count: 1,
        manual_charge: 123,
      }],
    }, staff.id)
    const fixedBreakup = await getPriceBreakup(fixedVariant._id || fixedVariant.id, 1)
    expect(fixedBreakup.stone_charge).toBe(123)
    expect(fixedBreakup.stone_breakup[0].pricing_mode).toBe('fixed')
  })

  it('StoneRate change updates new quote but not order snapshot', async () => {
    const created = await catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'Q-SNAP',
      label: 'q',
      purity: '22k',
      weight_grams: 4,
      effective_weight: 4,
      stock_qty: 2,
      stock_idempotency_key: 'q-snap:stock',
      idempotency_key: 'q-snap',
      product_stones: [{
        pricing_mode: 'rate',
        stone_rate_id: pieceRate.id,
        stone_type: 'ruby',
        grade: 'AA',
        unit: 'piece',
        stone_count: 2,
      }],
    }, staff.id)
    const before = await getPriceBreakup(created._id || created.id, 1)
    expect(before.stone_charge).toBe(80)

    const order = await Order.create({
      orderNumber: 'ORD-228-1',
      customerId: new mongoose.Types.ObjectId(),
      status: 'placed',
      paymentStatus: 'cod_pending',
      paymentMethod: 'cod',
      subtotal: before.subtotal_before_vat,
      taxAmount: before.vat_amount,
      shippingFee: 0,
      discountAmount: 0,
      total: before.total,
      estimatedTotal: before.total,
      amountDue: before.total,
      shipTo: { line1: 'Test', city: 'Dubai', country: 'United Arab Emirates' },
      idempotencyKey: 'ord-228-snap-1',
      items: [{
        productId: product.id,
        variantId: created._id || created.id,
        productName: product.name,
        sku: 'Q-SNAP',
        qty: 1,
        unitPrice: before.unit_subtotal_before_vat,
        lineTotal: before.subtotal_before_vat,
        stoneCharge: before.stone_charge,
        breakup: serialize(before),
      }],
    })
    const snapStone = order.items[0].breakup.stone_charge ?? order.items[0].stoneCharge

    await StoneRate.updateOne({ _id: pieceRate.id }, { $set: { rate: 100 } })
    const after = await getPriceBreakup(created._id || created.id, 1)
    expect(after.stone_charge).toBe(200)

    const freshOrder = await Order.findById(order.id)
    const frozen = freshOrder.items[0].breakup?.stone_charge ?? freshOrder.items[0].stoneCharge
    expect(frozen).toBe(snapStone)
    expect(frozen).toBe(80)
  })

  it('24K with stones still has VAT AED 0.00; mixed cart stays line-based', async () => {
    const v24 = await catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'VAT-24',
      label: '24',
      purity: '24k',
      weight_grams: 4,
      effective_weight: 4,
      stock_qty: 0,
      idempotency_key: 'vat-24',
      product_stones: [{
        pricing_mode: 'fixed',
        stone_type: 'diamond',
        unit: 'piece',
        stone_count: 1,
        manual_charge: 200,
      }],
    }, staff.id)
    const b24 = await getPriceBreakup(v24._id || v24.id, 1)
    expect(b24.tax_treatment).toBe('zero_rated')
    expect(b24.vat_amount).toBe(0)
    expect(b24.stone_charge).toBe(200)

    const v22 = await catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'VAT-22',
      label: '22',
      purity: '22k',
      weight_grams: 4,
      effective_weight: 4,
      stock_qty: 0,
      idempotency_key: 'vat-22',
    }, staff.id)
    const b22 = await getPriceBreakup(v22._id || v22.id, 1)
    expect(b22.vat_amount).toBeGreaterThan(0)
  })
})

describe('Phase 22.8 aggregate idempotency and generic mutate block', () => {
  it('identical replay succeeds; mismatched replay is 409; failure rolls back', async () => {
    const payload = {
      product_id: product.id,
      sku: 'AGG-ID',
      label: 'x',
      purity: '22k',
      weight_grams: 2,
      effective_weight: 2,
      stock_qty: 3,
      stock_idempotency_key: 'agg-id:stock',
      idempotency_key: 'agg-id',
      product_stones: [{
        pricing_mode: 'fixed',
        stone_type: 'x',
        unit: 'piece',
        stone_count: 1,
        manual_charge: 1,
      }],
    }
    const first = await catalogService.createVariantComplete(payload, staff.id)
    const second = await catalogService.createVariantComplete(payload, staff.id)
    expect(String(second._id || second.id)).toBe(String(first._id || first.id))
    expect(await StockMovement.countDocuments({ variantId: first._id || first.id })).toBe(1)

    await expect(catalogService.createVariantComplete({
      ...payload,
      sku: 'AGG-ID-DIFF',
      stock_qty: 9,
    }, staff.id)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })

    await expect(catalogService.createVariantComplete({
      product_id: product.id,
      sku: 'AGG-ROLL',
      label: 'x',
      purity: '22k',
      weight_grams: 2,
      effective_weight: 2,
      stock_qty: 2,
      stock_idempotency_key: 'agg-roll:stock',
      idempotency_key: 'agg-roll',
      product_stones: [{ stone_count: 1 }],
    }, staff.id)).rejects.toBeTruthy()
    expect(await Variant.countDocuments({ sku: 'AGG-ROLL' })).toBe(0)
    expect(await ProductStone.countDocuments()).toBe(1) // only from first create
    expect(await StockMovement.countDocuments({ note: /Initial stock while creating variant/ })).toBe(1)
  })

  it('generic variant/stone POST and PATCH cannot bypass aggregate', async () => {
    await expect(catalogService.create('variants', {
      product_id: product.id,
      sku: 'GEN-V',
      weight_grams: 2,
      effective_weight: 2,
    })).rejects.toMatchObject({ code: 'USE_VARIANT_AGGREGATE' })
    await expect(catalogService.update('variants', new mongoose.Types.ObjectId().toString(), {
      label: 'x',
    })).rejects.toMatchObject({ code: 'USE_VARIANT_AGGREGATE' })
    await expect(catalogService.create('stones', {
      variant_id: new mongoose.Types.ObjectId().toString(),
      stone_type: 'x',
      pricing_mode: 'fixed',
      manual_charge: 1,
      stone_count: 1,
      unit: 'piece',
    })).rejects.toMatchObject({ code: 'USE_VARIANT_AGGREGATE' })
    await expect(catalogService.update('stones', new mongoose.Types.ObjectId().toString(), {
      label: 'x',
    })).rejects.toMatchObject({ code: 'USE_VARIANT_AGGREGATE' })

    const res = await request(app)
      .post('/api/v1/admin/catalog/variants')
      .set('Cookie', staffCookie)
      .send({ product_id: product.id, sku: 'HTTP-V', weight_grams: 2, effective_weight: 2 })
    expect(res.status).toBe(422)
    expect(res.body.error?.code || res.body.code).toBe('USE_VARIANT_AGGREGATE')
  })
})

describe('Phase 22.8 inventory pagination and concurrency', () => {
  it('reaches record 201 and searches by product name server-side', async () => {
    const docs = Array.from({ length: 210 }, (_, i) => ({
      productId: product.id,
      sku: `INV-${String(i + 1).padStart(4, '0')}`,
      label: `L${i + 1}`,
      weightGrams: 2,
      effectiveWeight: 2,
      stockQty: i === 200 ? 7 : 1,
      purity: '22k',
      isActive: true,
    }))
    await Variant.insertMany(docs)

    const page5 = await adminService.variants({ page: 5, limit: 50 })
    expect(page5.total).toBeGreaterThanOrEqual(210)
    expect(page5.items.length).toBeGreaterThan(0)

    const found = await adminService.variants({ page: 1, limit: 10, search: 'Needle Inventory Product' })
    expect(found.total).toBeGreaterThanOrEqual(210)
    expect(found.items.every((row) => String(row.productId?._id || row.productId) === String(product.id))).toBe(true)

    const http = await request(app)
      .get('/api/v1/admin/inventory/variants')
      .query({ page: 1, limit: 50, search: 'INV-0201' })
      .set('Cookie', staffCookie)
    expect(http.status).toBe(200)
    expect(http.body.meta.total).toBeGreaterThanOrEqual(1)
    expect((http.body.data || []).some((row) => row.sku === 'INV-0201')).toBe(true)
  })

  it('two concurrent +1 adjustments result in +2; decrement never goes negative', async () => {
    const variant = await Variant.create({
      productId: product.id,
      sku: 'CONC-1',
      label: 'c',
      weightGrams: 2,
      effectiveWeight: 2,
      stockQty: 5,
      purity: '22k',
      isActive: true,
    })
    await Promise.all([
      adjustStock(variant.id, 1, 'admin_adjustment', null, staff.id, { idempotencyKey: 'conc-plus-a' }),
      adjustStock(variant.id, 1, 'admin_adjustment', null, staff.id, { idempotencyKey: 'conc-plus-b' }),
    ])
    expect((await Variant.findById(variant.id)).stockQty).toBe(7)

    const low = await Variant.create({
      productId: product.id,
      sku: 'CONC-2',
      label: 'c',
      weightGrams: 2,
      effectiveWeight: 2,
      stockQty: 1,
      purity: '22k',
      isActive: true,
    })
    const results = await Promise.allSettled([
      adjustStock(low.id, -1, 'admin_adjustment', null, staff.id, { idempotencyKey: 'conc-dec-a' }),
      adjustStock(low.id, -1, 'admin_adjustment', null, staff.id, { idempotencyKey: 'conc-dec-b' }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
    expect((await Variant.findById(low.id)).stockQty).toBe(0)
  })

  it('stale absolute set conflicts; same replay one movement; changed key request conflicts; ledger reconciles', async () => {
    const variant = await Variant.create({
      productId: product.id,
      sku: 'SET-1',
      label: 'c',
      weightGrams: 2,
      effectiveWeight: 2,
      stockQty: 10,
      purity: '22k',
      isActive: true,
    })
    const first = await setStock(variant.id, {
      qty: 20,
      expectedBefore: 10,
      reason: 'admin_adjustment',
      actorId: staff.id,
      idempotencyKey: 'set-reconcile-1',
    })
    expect(first.stockQty).toBe(20)
    const retry = await setStock(variant.id, {
      qty: 20,
      expectedBefore: 10,
      reason: 'admin_adjustment',
      actorId: staff.id,
      idempotencyKey: 'set-reconcile-1',
    })
    expect(retry.stockQty).toBe(20)
    expect(await StockMovement.countDocuments({ idempotencyKey: 'set-reconcile-1' })).toBe(1)

    await expect(setStock(variant.id, {
      qty: 30,
      expectedBefore: 10,
      reason: 'admin_adjustment',
      actorId: staff.id,
      idempotencyKey: 'set-stale',
    })).rejects.toMatchObject({ code: 'STOCK_VERSION_CONFLICT' })

    await expect(setStock(variant.id, {
      qty: 99,
      expectedBefore: 20,
      reason: 'admin_adjustment',
      actorId: staff.id,
      idempotencyKey: 'set-reconcile-1',
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })

    const blank = setStockSchema.shape.body.safeParse({
      qty: '',
      expected_before: 20,
      idempotency_key: 'blank-qty-key1',
    })
    expect(blank.success).toBe(false)

    const movement = await StockMovement.findOne({ idempotencyKey: 'set-reconcile-1' })
    expect(movement.qtyBefore).toBe(10)
    expect(movement.delta).toBe(10)
    expect(movement.qtyAfter).toBe(20)
    expect(movement.qtyBefore + movement.delta).toBe(movement.qtyAfter)
  })
})

describe('Phase 22.8 create schema rejects non-numeric stock', () => {
  it('createVariantCompleteSchema rejects non-numeric stock_qty', () => {
    const parsed = createVariantCompleteSchema.body.safeParse({
      product_id: product.id,
      sku: 'Z',
      weight_grams: 2,
      effective_weight: 2,
      stock_qty: 'not-a-number',
    })
    expect(parsed.success).toBe(false)

    const blankOmitted = createVariantCompleteSchema.body.safeParse({
      product_id: product.id,
      sku: 'Z2',
      weight_grams: 2,
      effective_weight: 2,
      stock_qty: '',
    })
    // blank optional → treated as omitted (not coerced to 0)
    expect(blankOmitted.success).toBe(true)
    expect(blankOmitted.data.stock_qty).toBeUndefined()
  })
})
