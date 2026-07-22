/**
 * Phase 22.2–22.4 — Product / Category / Brand mutation contracts.
 * Uses exact frontend payload shapes (toProductPayload / toCategoryPayload / toBrandPayload).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import app from '../src/app.js'
import { Customer, Staff } from '../src/models/auth.models.js'
import { Brand, Category, Product, StoreSetting, TaxSetting } from '../src/models/catalog.models.js'
import { hashPassword, issueSession } from '../src/services/auth.service.js'
import { SESSION_COOKIES } from '../src/utils/sessionCookies.js'

let mongoServer
let staffCookie
let customerCookie

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
}

/** Mirrors frontend/src/lib/productDefaults.js `toProductPayload`. */
function toProductPayload(input = {}) {
  const wastagePercentRaw =
    input.wastage_percent == null || input.wastage_percent === ''
      ? 0
      : Number(input.wastage_percent)
  const wastagePercent = Number.isFinite(wastagePercentRaw)
    ? Math.max(0, wastagePercentRaw)
    : 0
  return {
    category_id: input.category_id || null,
    name: input.name ?? null,
    name_ar: input.name_ar ?? null,
    slug: input.slug ?? null,
    brand_id: input.brand_id || null,
    description: input.description ?? null,
    description_ar: input.description_ar ?? null,
    short_description: input.short_description ?? input.short_desc ?? null,
    short_description_ar: input.short_description_ar ?? input.short_desc_ar ?? null,
    metal_type: input.metal_type ?? 'gold',
    metal_color: input.metal_color ?? 'yellow',
    purity: input.purity ?? null,
    gender: input.gender ?? 'unisex',
    occasion: Array.isArray(input.occasion) ? input.occasion.map(String).filter(Boolean) : [],
    making_charge_type: input.making_charge_type ?? 'percent',
    making_charge_value: Number(input.making_charge_value) || 0,
    wastage_percent: wastagePercent,
    tax_treatment:
      input.tax_treatment === 'investment_precious_metal_zero_rated'
        ? 'investment_precious_metal_zero_rated'
        : 'standard',
    status: input.status ?? 'draft',
    is_featured: input.is_featured === true,
    display_order: Number(input.display_order) || 0,
    is_customizable: input.is_customizable === true,
    customization_note: input.customization_note ?? null,
  }
}

/** Mirrors frontend/src/lib/catalogPayloads.js `toCategoryPayload`. */
function toCategoryPayload(input = {}) {
  return {
    name: input.name ?? null,
    name_ar: input.name_ar ?? null,
    slug: input.slug ?? null,
    description: input.description ?? null,
    description_ar: input.description_ar ?? null,
    parent_id: input.parent_id || null,
    image_url: input.image_url || null,
    display_order: Number(input.display_order) || 0,
    is_active: input.is_active !== false,
  }
}

/** Mirrors frontend/src/lib/catalogPayloads.js `toBrandPayload`. */
function toBrandPayload(input = {}) {
  const payload = {
    name: typeof input.name === 'string' ? input.name.trim() : input.name ?? null,
    name_ar: input.name_ar ?? null,
    slug: input.slug ?? null,
    description: input.description ?? null,
    description_ar: input.description_ar ?? null,
    logo_desktop_url: input.logo_desktop_url || null,
    logo_tablet_url: input.logo_tablet_url || null,
    logo_mobile_url: input.logo_mobile_url || null,
    banner_desktop_url: input.banner_desktop_url || null,
    banner_tablet_url: input.banner_tablet_url || null,
    banner_mobile_url: input.banner_mobile_url || null,
    display_order: Number(input.display_order) || 0,
    is_active: input.is_active !== false,
  }
  if (Object.prototype.hasOwnProperty.call(input, 'logo_url')) {
    payload.logo_url = input.logo_url || null
  }
  return payload
}

const PRODUCT_FIELDS = [
  'category_id', 'brand_id', 'name', 'name_ar', 'slug',
  'description', 'description_ar', 'short_description', 'short_description_ar',
  'metal_type', 'metal_color', 'purity', 'gender', 'occasion',
  'making_charge_type', 'making_charge_value', 'wastage_percent', 'tax_treatment',
  'status', 'is_featured', 'display_order', 'is_customizable', 'customization_note',
]

const CATEGORY_FIELDS = [
  'name', 'name_ar', 'slug', 'description', 'description_ar',
  'parent_id', 'image_url', 'display_order', 'is_active',
]

const BRAND_FIELDS = [
  'name', 'name_ar', 'slug', 'description', 'description_ar',
  'logo_desktop_url', 'logo_tablet_url', 'logo_mobile_url',
  'banner_desktop_url', 'banner_tablet_url', 'banner_mobile_url',
  'display_order', 'is_active',
]

function assertFieldsMatch(actual, expected, fields) {
  for (const key of fields) {
    const a = actual[key]
    const e = expected[key]
    if (Array.isArray(e)) {
      expect(a).toEqual(e)
    } else if (typeof e === 'number') {
      expect(Number(a)).toBe(e)
    } else {
      expect(a).toBe(e)
    }
  }
}

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-catalog-contract'))
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})))
  await StoreSetting.create({ singleton: 'default', storeName: 'Goldex' })
  await TaxSetting.create({ singleton: 'default', isActive: true, taxPercent: 5 })

  const staff = await Staff.create({
    fullName: 'Catalog Manager',
    email: 'catalog-manager@example.com',
    passwordHash: await hashPassword('password-12345678'),
    role: 'manager',
    isActive: true,
  })
  const staffTokens = await issueSession(staff, 'staff')
  staffCookie = cookieHeader({
    [SESSION_COOKIES.staffAccess]: staffTokens.accessToken,
    [SESSION_COOKIES.staffRefresh]: staffTokens.refreshToken,
  })

  const customer = await Customer.create({
    phone: '+971501555001',
    fullName: 'Catalog Customer',
    authProvider: 'otp',
    isActive: true,
  })
  const customerTokens = await issueSession(customer, 'customer')
  customerCookie = cookieHeader({
    [SESSION_COOKIES.customerAccess]: customerTokens.accessToken,
    [SESSION_COOKIES.customerRefresh]: customerTokens.refreshToken,
  })
})

describe('Phase 22.2 product contract', () => {
  it('creates with exact frontend toProductPayload and persists every field', async () => {
    const category = await Category.create({ name: 'Rings', slug: 'rings-p22', isActive: true })
    const brand = await Brand.create({ name: 'Aura', slug: 'aura-p22', isActive: true })

    const payload = toProductPayload({
      category_id: category.id,
      brand_id: brand.id,
      name: 'Classic Ring',
      name_ar: 'خاتم كلاسيك',
      slug: 'classic-ring-p22',
      description: 'English description',
      description_ar: 'وصف عربي',
      short_description: 'Short EN',
      short_description_ar: 'قصير',
      metal_type: 'gold',
      metal_color: 'rose',
      purity: '22k',
      gender: 'female',
      occasion: ['wedding', 'daily'],
      making_charge_type: 'percent',
      making_charge_value: 12.5,
      wastage_percent: 3,
      tax_treatment: 'standard',
      status: 'active',
      is_featured: true,
      display_order: 7,
      is_customizable: true,
      customization_note: 'Engrave initials',
    })

    const createRes = await request(app)
      .post('/api/v1/admin/catalog/products')
      .set('Cookie', staffCookie)
      .send(payload)

    expect(createRes.status).toBe(201)
    expect(createRes.body?.data?.id).toBeTruthy()
    assertFieldsMatch(createRes.body.data, {
      ...payload,
      purity: '22k',
      tax_treatment: 'standard',
    }, PRODUCT_FIELDS)

    const getRes = await request(app)
      .get(`/api/v1/admin/catalog/products/${createRes.body.data.id}`)
      .set('Cookie', staffCookie)

    expect(getRes.status).toBe(200)
    assertFieldsMatch(getRes.body.data, {
      ...payload,
      purity: '22k',
      tax_treatment: 'standard',
    }, PRODUCT_FIELDS)

    const db = await Product.findById(createRes.body.data.id).lean()
    expect(db.shortDescription).toBe('Short EN')
    expect(db.shortDescriptionAr).toBe('قصير')
    expect(db.metalColor).toBe('rose')
    expect(db.makingChargeType).toBe('percent')
    expect(db.makingChargeValue).toBe(12.5)
    expect(db.wastagePercent).toBe(3)
    expect(db.customizationNote).toBe('Engrave initials')
    expect(db.isCustomizable).toBe(true)
  })

  it('updates with exact frontend payload and forces 24KT to zero_rated', async () => {
    const category = await Category.create({ name: 'Bars', slug: 'bars-p22', isActive: true })
    const created = await request(app)
      .post('/api/v1/admin/catalog/products')
      .set('Cookie', staffCookie)
      .send(toProductPayload({
        category_id: category.id,
        name: 'Gold Bar',
        slug: 'gold-bar-p22',
        purity: '22k',
        tax_treatment: 'standard',
        status: 'draft',
      }))

    expect(created.status).toBe(201)
    const id = created.body.data.id

    const updatePayload = toProductPayload({
      category_id: category.id,
      name: '24KT Investment Bar',
      name_ar: 'سبيكة',
      slug: 'gold-bar-p22',
      description: 'Updated',
      description_ar: 'محدث',
      short_description: 'Bar',
      short_description_ar: 'سبيكة قصيرة',
      metal_type: 'gold',
      metal_color: 'yellow',
      purity: '24k',
      gender: 'unisex',
      occasion: ['investment'],
      making_charge_type: 'flat',
      making_charge_value: 50,
      wastage_percent: 0,
      tax_treatment: 'standard', // FE always sends standard; backend must force zero_rated for 24k
      status: 'active',
      is_featured: false,
      display_order: 1,
      is_customizable: false,
      customization_note: null,
    })

    const patchRes = await request(app)
      .patch(`/api/v1/admin/catalog/products/${id}`)
      .set('Cookie', staffCookie)
      .send(updatePayload)

    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.purity).toBe('24k')
    expect(patchRes.body.data.tax_treatment).toBe('zero_rated')
    expect(patchRes.body.data.making_charge_type).toBe('flat')
    expect(patchRes.body.data.making_charge_value).toBe(50)

    const forceStandard = await request(app)
      .patch(`/api/v1/admin/catalog/products/${id}`)
      .set('Cookie', staffCookie)
      .send({ tax_treatment: 'standard', purity: '24k' })

    expect(forceStandard.status).toBe(200)
    expect(forceStandard.body.data.tax_treatment).toBe('zero_rated')
  })

  it('rejects unknown fields, empty PATCH, conflicting aliases, invalid ids, and unauthorized', async () => {
    const category = await Category.create({ name: 'C', slug: 'c-unk', isActive: true })
    const created = await request(app)
      .post('/api/v1/admin/catalog/products')
      .set('Cookie', staffCookie)
      .send(toProductPayload({
        category_id: category.id,
        name: 'P',
        slug: 'p-unk',
        purity: '22k',
      }))
    const id = created.body.data.id

    const unknown = await request(app)
      .post('/api/v1/admin/catalog/products')
      .set('Cookie', staffCookie)
      .send({ ...toProductPayload({ name: 'X', slug: 'x-unk', purity: '22k' }), video_url: 'https://evil.example' })
    expect(unknown.status).toBe(422)

    const emptyPatch = await request(app)
      .patch(`/api/v1/admin/catalog/products/${id}`)
      .set('Cookie', staffCookie)
      .send({})
    expect(emptyPatch.status).toBe(422)

    const conflict = await request(app)
      .patch(`/api/v1/admin/catalog/products/${id}`)
      .set('Cookie', staffCookie)
      .send({ name_ar: 'أ', nameAr: 'ب' })
    expect(conflict.status).toBe(422)

    const badId = await request(app)
      .post('/api/v1/admin/catalog/products')
      .set('Cookie', staffCookie)
      .send(toProductPayload({
        category_id: 'not-an-object-id',
        name: 'Bad',
        slug: 'bad-id',
        purity: '22k',
      }))
    expect(badId.status).toBe(422)

    const unauth = await request(app)
      .post('/api/v1/admin/catalog/products')
      .set('Cookie', customerCookie)
      .send(toProductPayload({ name: 'Nope', slug: 'nope', purity: '22k' }))
    expect([401, 403]).toContain(unauth.status)

    const noCookie = await request(app)
      .post('/api/v1/admin/catalog/products')
      .send(toProductPayload({ name: 'Nope2', slug: 'nope2', purity: '22k' }))
    expect([401, 403]).toContain(noCookie.status)
  })

  it('discovers a product beyond the first page via search filter', async () => {
    const category = await Category.create({ name: 'PageCat', slug: 'page-cat', isActive: true })
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/v1/admin/catalog/products')
        .set('Cookie', staffCookie)
        .send(toProductPayload({
          category_id: category.id,
          name: `Page Product ${i}`,
          slug: `page-product-${i}`,
          purity: '22k',
          status: 'active',
          display_order: i,
        }))
    }
    const needle = await request(app)
      .post('/api/v1/admin/catalog/products')
      .set('Cookie', staffCookie)
      .send(toProductPayload({
        category_id: category.id,
        name: 'Unique Needle Ring',
        slug: 'unique-needle-ring',
        purity: '22k',
        status: 'active',
        display_order: 99,
      }))
    expect(needle.status).toBe(201)

    const page1 = await request(app)
      .get('/api/v1/admin/catalog/products')
      .query({ page: 1, limit: 2 })
      .set('Cookie', staffCookie)
    expect(page1.status).toBe(200)
    expect(page1.body.data.length).toBeLessThanOrEqual(2)
    expect(page1.body.data.some((row) => row.slug === 'unique-needle-ring')).toBe(false)

    const found = await request(app)
      .get('/api/v1/admin/catalog/products')
      .query({ search: 'Unique Needle', limit: 10 })
      .set('Cookie', staffCookie)
    expect(found.status).toBe(200)
    expect(found.body.data.some((row) => row.slug === 'unique-needle-ring')).toBe(true)
  })
})

describe('Phase 22.3 category contract', () => {
  it('creates and updates with CategoryFormDialog payload; every field persists', async () => {
    const parent = await Category.create({ name: 'Parent', slug: 'parent-p22', isActive: true })
    const payload = toCategoryPayload({
      name: 'Wedding',
      name_ar: 'زفاف',
      slug: 'wedding-p22',
      description: 'Wedding jewellery',
      description_ar: 'مجوهرات زفاف',
      parent_id: parent.id,
      image_url: 'https://cdn.example.com/cat.jpg',
      display_order: 4,
      is_active: true,
    })

    const createRes = await request(app)
      .post('/api/v1/admin/catalog/categories')
      .set('Cookie', staffCookie)
      .send(payload)

    expect(createRes.status).toBe(201)
    assertFieldsMatch(createRes.body.data, payload, CATEGORY_FIELDS)

    const getRes = await request(app)
      .get(`/api/v1/admin/catalog/categories/${createRes.body.data.id}`)
      .set('Cookie', staffCookie)
    expect(getRes.status).toBe(200)
    assertFieldsMatch(getRes.body.data, payload, CATEGORY_FIELDS)

    const updatePayload = toCategoryPayload({
      ...payload,
      description: 'Updated wedding',
      description_ar: 'محدث',
      display_order: 9,
      is_active: false,
      parent_id: null,
    })
    const patchRes = await request(app)
      .patch(`/api/v1/admin/catalog/categories/${createRes.body.data.id}`)
      .set('Cookie', staffCookie)
      .send(updatePayload)
    expect(patchRes.status).toBe(200)
    assertFieldsMatch(patchRes.body.data, updatePayload, CATEGORY_FIELDS)
  })

  it('rejects unknown fields, empty PATCH, conflicting aliases, invalid parent, unauthorized', async () => {
    const created = await request(app)
      .post('/api/v1/admin/catalog/categories')
      .set('Cookie', staffCookie)
      .send(toCategoryPayload({ name: 'C', slug: 'c-cat' }))
    const id = created.body.data.id

    expect((await request(app)
      .post('/api/v1/admin/catalog/categories')
      .set('Cookie', staffCookie)
      .send({ ...toCategoryPayload({ name: 'X', slug: 'x-cat' }), extra_field: 1 })).status).toBe(422)

    expect((await request(app)
      .patch(`/api/v1/admin/catalog/categories/${id}`)
      .set('Cookie', staffCookie)
      .send({})).status).toBe(422)

    expect((await request(app)
      .patch(`/api/v1/admin/catalog/categories/${id}`)
      .set('Cookie', staffCookie)
      .send({ is_active: true, isActive: false })).status).toBe(422)

    expect((await request(app)
      .post('/api/v1/admin/catalog/categories')
      .set('Cookie', staffCookie)
      .send(toCategoryPayload({ name: 'Bad', slug: 'bad-parent', parent_id: 'zz' }))).status).toBe(422)

    expect([401, 403]).toContain((await request(app)
      .post('/api/v1/admin/catalog/categories')
      .set('Cookie', customerCookie)
      .send(toCategoryPayload({ name: 'N', slug: 'n-cat' }))).status)
  })

  it('discovers a category beyond the first page via search', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/v1/admin/catalog/categories')
        .set('Cookie', staffCookie)
        .send(toCategoryPayload({ name: `Cat ${i}`, slug: `cat-page-${i}`, display_order: i }))
    }
    await request(app)
      .post('/api/v1/admin/catalog/categories')
      .set('Cookie', staffCookie)
      .send(toCategoryPayload({ name: 'Needle Category', slug: 'needle-category', display_order: 99 }))

    const page1 = await request(app)
      .get('/api/v1/admin/catalog/categories')
      .query({ page: 1, limit: 2 })
      .set('Cookie', staffCookie)
    expect(page1.body.data.some((row) => row.slug === 'needle-category')).toBe(false)

    const found = await request(app)
      .get('/api/v1/admin/catalog/categories')
      .query({ search: 'Needle Category' })
      .set('Cookie', staffCookie)
    expect(found.body.data.some((row) => row.slug === 'needle-category')).toBe(true)
  })
})

describe('Phase 22.4 brand contract', () => {
  it('creates and updates brand with Arabic description and every responsive image URL', async () => {
    const payload = toBrandPayload({
      name: 'Maison Or',
      name_ar: 'ميزون أور',
      slug: 'maison-or-p22',
      description: 'Luxury maison',
      description_ar: 'وصف عربي للعلامة',
      logo_desktop_url: 'https://cdn.example.com/logo-d.png',
      logo_tablet_url: 'https://cdn.example.com/logo-t.png',
      logo_mobile_url: 'https://cdn.example.com/logo-m.png',
      banner_desktop_url: 'https://cdn.example.com/ban-d.png',
      banner_tablet_url: 'https://cdn.example.com/ban-t.png',
      banner_mobile_url: 'https://cdn.example.com/ban-m.png',
      display_order: 3,
      is_active: true,
    })

    const createRes = await request(app)
      .post('/api/v1/admin/catalog/brands')
      .set('Cookie', staffCookie)
      .send(payload)

    expect(createRes.status).toBe(201)
    assertFieldsMatch(createRes.body.data, payload, BRAND_FIELDS)

    const getRes = await request(app)
      .get(`/api/v1/admin/catalog/brands/${createRes.body.data.id}`)
      .set('Cookie', staffCookie)
    expect(getRes.status).toBe(200)
    assertFieldsMatch(getRes.body.data, payload, BRAND_FIELDS)

    const db = await Brand.findById(createRes.body.data.id).lean()
    expect(db.descriptionAr).toBe('وصف عربي للعلامة')
    expect(db.logoDesktopUrl).toBe(payload.logo_desktop_url)
    expect(db.bannerMobileUrl).toBe(payload.banner_mobile_url)

    const updatePayload = toBrandPayload({
      ...payload,
      description_ar: 'وصف محدث',
      logo_mobile_url: 'https://cdn.example.com/logo-m2.png',
      display_order: 8,
    })
    const patchRes = await request(app)
      .patch(`/api/v1/admin/catalog/brands/${createRes.body.data.id}`)
      .set('Cookie', staffCookie)
      .send(updatePayload)
    expect(patchRes.status).toBe(200)
    assertFieldsMatch(patchRes.body.data, updatePayload, BRAND_FIELDS)
  })

  it('retains legacy logo_url when responsive logos are set', async () => {
    const brand = await Brand.create({
      name: 'Legacy',
      slug: 'legacy-logo',
      logoUrl: 'https://cdn.example.com/legacy.png',
      isActive: true,
    })

    const patchRes = await request(app)
      .patch(`/api/v1/admin/catalog/brands/${brand.id}`)
      .set('Cookie', staffCookie)
      .send(toBrandPayload({
        name: 'Legacy',
        slug: 'legacy-logo',
        logo_desktop_url: 'https://cdn.example.com/new-d.png',
        logo_tablet_url: 'https://cdn.example.com/new-t.png',
        logo_mobile_url: 'https://cdn.example.com/new-m.png',
      }))

    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.logo_desktop_url).toBe('https://cdn.example.com/new-d.png')
    expect(patchRes.body.data.logo_url).toBe('https://cdn.example.com/legacy.png')

    const db = await Brand.findById(brand.id).lean()
    expect(db.logoUrl).toBe('https://cdn.example.com/legacy.png')
  })

  it('rejects unknown fields, empty PATCH, conflicting aliases, unauthorized', async () => {
    const created = await request(app)
      .post('/api/v1/admin/catalog/brands')
      .set('Cookie', staffCookie)
      .send(toBrandPayload({ name: 'B', slug: 'b-brand' }))
    const id = created.body.data.id

    expect((await request(app)
      .post('/api/v1/admin/catalog/brands')
      .set('Cookie', staffCookie)
      .send({ ...toBrandPayload({ name: 'X', slug: 'x-brand' }), website: 'x' })).status).toBe(422)

    expect((await request(app)
      .patch(`/api/v1/admin/catalog/brands/${id}`)
      .set('Cookie', staffCookie)
      .send({})).status).toBe(422)

    expect((await request(app)
      .patch(`/api/v1/admin/catalog/brands/${id}`)
      .set('Cookie', staffCookie)
      .send({ logo_desktop_url: 'a', logoDesktopUrl: 'b' })).status).toBe(422)

    expect([401, 403]).toContain((await request(app)
      .post('/api/v1/admin/catalog/brands')
      .set('Cookie', customerCookie)
      .send(toBrandPayload({ name: 'N', slug: 'n-brand' }))).status)
  })

  it('discovers a brand beyond the first page via search', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/v1/admin/catalog/brands')
        .set('Cookie', staffCookie)
        .send(toBrandPayload({ name: `Brand ${i}`, slug: `brand-page-${i}`, display_order: i }))
    }
    await request(app)
      .post('/api/v1/admin/catalog/brands')
      .set('Cookie', staffCookie)
      .send(toBrandPayload({ name: 'Needle Brand', slug: 'needle-brand', display_order: 99 }))

    const page1 = await request(app)
      .get('/api/v1/admin/catalog/brands')
      .query({ page: 1, limit: 2 })
      .set('Cookie', staffCookie)
    expect(page1.body.data.some((row) => row.slug === 'needle-brand')).toBe(false)

    const found = await request(app)
      .get('/api/v1/admin/catalog/brands')
      .query({ search: 'Needle Brand' })
      .set('Cookie', staffCookie)
    expect(found.body.data.some((row) => row.slug === 'needle-brand')).toBe(true)
  })
})
