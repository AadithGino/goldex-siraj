/**
 * Phase 22.7 — Banner / Certificate / CMS / ProductImage mutation contracts.
 * Uses exact frontend payload shapes (toBannerPayload / toCertificatePayload / toCmsPayload).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import app from '../src/app.js'
import { Customer, Staff } from '../src/models/auth.models.js'
import {
  Brand,
  Category,
  Certificate,
  Product,
  ProductImage,
  StoreSetting,
  TaxSetting,
  Variant,
} from '../src/models/catalog.models.js'
import { hashPassword, issueSession } from '../src/services/auth.service.js'
import { dubaiDayEndUtc, dubaiYmd } from '../src/utils/dubaiTime.js'
import { SESSION_COOKIES } from '../src/utils/sessionCookies.js'

let mongoServer
let staffCookie
let customerCookie

const BANNER_POSITIONS = [
  'hero', 'strip', 'collection', 'promo_top', 'deal', 'gifting', 'promo_bottom',
]

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
}

function shiftDubaiYmd(ymd, deltaDays) {
  const start = new Date(`${ymd}T00:00:00.000+04:00`)
  return dubaiYmd(new Date(start.getTime() + deltaDays * 24 * 3600 * 1000))
}

/** Mirrors frontend/src/lib/bannerPayload.js `toBannerPayload`. */
function toBannerPayload(input = {}) {
  return {
    position: input.position ?? 'hero',
    title: input.title ?? 'Banner',
    title_ar: input.title_ar ?? null,
    subtitle: input.subtitle ?? null,
    subtitle_ar: input.subtitle_ar ?? null,
    eyebrow: input.eyebrow ?? null,
    eyebrow_ar: input.eyebrow_ar ?? null,
    image_url: input.image_url ?? 'https://cdn.example.com/banner-d.jpg',
    image_url_ar: input.image_url_ar ?? null,
    mobile_image_url: input.mobile_image_url ?? 'https://cdn.example.com/banner-m.jpg',
    mobile_image_url_ar: input.mobile_image_url_ar ?? null,
    cta_text: input.cta_text ?? null,
    cta_text_ar: input.cta_text_ar ?? null,
    cta_link: input.cta_link ?? null,
    display_order: input.display_order ?? 0,
    is_active: input.is_active !== false,
    starts_at: Object.prototype.hasOwnProperty.call(input, 'starts_at') ? input.starts_at : null,
    ends_at: Object.prototype.hasOwnProperty.call(input, 'ends_at') ? input.ends_at : null,
  }
}

/** Mirrors frontend/src/lib/certificatePayload.js `toCertificatePayload`. */
function toCertificatePayload(input = {}) {
  return {
    product_id: input.product_id,
    variant_id: Object.prototype.hasOwnProperty.call(input, 'variant_id') ? input.variant_id : null,
    cert_number: input.cert_number ?? 'CERT-001',
    authority: input.authority ?? 'GIA',
    issued_date: Object.prototype.hasOwnProperty.call(input, 'issued_date') ? input.issued_date : null,
    metadata: input.metadata ?? {},
    ...(Object.prototype.hasOwnProperty.call(input, 'file_url')
      ? { file_url: input.file_url }
      : { file_url: 'https://cdn.example.com/cert.pdf' }),
  }
}

/** Mirrors frontend/src/lib/cmsPayload.js `toCmsPayload` (pre-sanitize content for API). */
function toCmsPayload(input = {}) {
  return {
    slug: input.slug ?? 'about',
    title: input.title ?? 'About',
    title_ar: Object.prototype.hasOwnProperty.call(input, 'title_ar') ? input.title_ar : null,
    content: input.content ?? '<p>Hello</p>',
    content_ar: Object.prototype.hasOwnProperty.call(input, 'content_ar') ? input.content_ar : null,
    is_published: input.is_published === true,
  }
}

async function seedProduct(slug = 'ring-p227') {
  const category = await Category.create({ name: 'Rings', slug: `cat-${slug}`, isActive: true })
  const brand = await Brand.create({ name: 'Aura', slug: `brand-${slug}`, isActive: true })
  const product = await Product.create({
    name: 'Classic Ring',
    slug,
    categoryId: category.id,
    brandId: brand.id,
    status: 'active',
    metalType: 'gold',
    purity: '22k',
    taxTreatment: 'standard',
  })
  const variant = await Variant.create({
    productId: product.id,
    sku: `SKU-${slug}`,
    label: '16',
    weightGrams: 4,
    effectiveWeight: 4,
    stockQty: 10,
    purity: '22k',
    isActive: true,
    taxTreatment: 'standard',
  })
  return { category, brand, product, variant }
}

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongoServer.getUri('goldex-banner-cms-cert-image'))
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
    fullName: 'Catalog CMS Manager',
    email: 'cms-manager@example.com',
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
    phone: '+971501666001',
    fullName: 'CMS Customer',
    authProvider: 'otp',
    isActive: true,
  })
  const customerTokens = await issueSession(customer, 'customer')
  customerCookie = cookieHeader({
    [SESSION_COOKIES.customerAccess]: customerTokens.accessToken,
    [SESSION_COOKIES.customerRefresh]: customerTokens.refreshToken,
  })
})

describe('Phase 22.7 banner contract', () => {
  it('creates with full FE payload and accepts all 7 positions', async () => {
    const today = dubaiYmd()
    const payload = toBannerPayload({
      position: 'hero',
      title: 'Eid Edit',
      title_ar: 'عيد',
      subtitle: 'Shop the collection',
      subtitle_ar: 'تسوق',
      eyebrow: 'New',
      eyebrow_ar: 'جديد',
      image_url: 'https://cdn.example.com/hero-d.jpg',
      image_url_ar: 'https://cdn.example.com/hero-d-ar.jpg',
      mobile_image_url: 'https://cdn.example.com/hero-m.jpg',
      mobile_image_url_ar: 'https://cdn.example.com/hero-m-ar.jpg',
      cta_text: 'Shop now',
      cta_text_ar: 'تسوق الآن',
      cta_link: '/collections/eid',
      display_order: 3,
      is_active: true,
      starts_at: today,
      ends_at: shiftDubaiYmd(today, 7),
    })

    const createRes = await request(app)
      .post('/api/v1/admin/catalog/banners')
      .set('Cookie', staffCookie)
      .send(payload)

    expect(createRes.status).toBe(201)
    expect(createRes.body.data.position).toBe('hero')
    expect(createRes.body.data.title).toBe('Eid Edit')
    expect(createRes.body.data.title_ar).toBe('عيد')
    expect(createRes.body.data.image_url).toBe(payload.image_url)
    expect(createRes.body.data.mobile_image_url).toBe(payload.mobile_image_url)
    expect(createRes.body.data.cta_link).toBe('/collections/eid')
    expect(createRes.body.data.display_order).toBe(3)
    expect(createRes.body.data.is_active).toBe(true)

    for (const position of BANNER_POSITIONS) {
      if (position === 'hero') continue
      const res = await request(app)
        .post('/api/v1/admin/catalog/banners')
        .set('Cookie', staffCookie)
        .send(toBannerPayload({
          position,
          title: `Banner ${position}`,
          display_order: BANNER_POSITIONS.indexOf(position),
        }))
      expect(res.status).toBe(201)
      expect(res.body.data.position).toBe(position)
    }
  })

  it('rejects unknown field / alias conflict and invalid display_order', async () => {
    const base = toBannerPayload({ title: 'X', position: 'strip' })

    expect((await request(app)
      .post('/api/v1/admin/catalog/banners')
      .set('Cookie', staffCookie)
      .send({ ...base, link_url: '/legacy', cta_link: '/ok' })).status).toBe(422)

    expect((await request(app)
      .post('/api/v1/admin/catalog/banners')
      .set('Cookie', staffCookie)
      .send({ ...base, title_ar: 'أ', titleAr: 'ب' })).status).toBe(422)

    expect((await request(app)
      .post('/api/v1/admin/catalog/banners')
      .set('Cookie', staffCookie)
      .send({ ...base, display_order: 1.5 })).status).toBe(422)

    expect((await request(app)
      .post('/api/v1/admin/catalog/banners')
      .set('Cookie', staffCookie)
      .send({ ...base, display_order: 'abc' })).status).toBe(422)
  })

  it('round-trips Dubai calendar starts_at/ends_at on admin GET', async () => {
    const today = dubaiYmd()
    const end = shiftDubaiYmd(today, 3)
    const createRes = await request(app)
      .post('/api/v1/admin/catalog/banners')
      .set('Cookie', staffCookie)
      .send(toBannerPayload({
        position: 'deal',
        title: 'Date Round Trip',
        starts_at: today,
        ends_at: end,
      }))
    expect(createRes.status).toBe(201)

    const getRes = await request(app)
      .get(`/api/v1/admin/catalog/banners/${createRes.body.data.id}`)
      .set('Cookie', staffCookie)
    expect(getRes.status).toBe(200)
    expect(dubaiYmd(new Date(getRes.body.data.starts_at))).toBe(today)
    expect(dubaiYmd(new Date(getRes.body.data.ends_at))).toBe(end)
    expect(getRes.body.data.ends_at).toBe(dubaiDayEndUtc(end).toISOString())
  })

  it('keeps inclusive end-of-Dubai-day banners public; yesterday excluded', async () => {
    const today = dubaiYmd()
    const yesterday = shiftDubaiYmd(today, -1)

    const createRes = await request(app)
      .post('/api/v1/admin/catalog/banners')
      .set('Cookie', staffCookie)
      .send(toBannerPayload({
        position: 'promo_top',
        title: 'Ends Today',
        is_active: true,
        starts_at: yesterday,
        ends_at: today,
      }))
    expect(createRes.status).toBe(201)
    const id = createRes.body.data.id
    expect(createRes.body.data.ends_at).toBe(dubaiDayEndUtc(today).toISOString())

    const publicToday = await request(app)
      .get('/api/v1/customer/catalog/banners')
      .set('Cookie', customerCookie)
    expect(publicToday.status).toBe(200)
    expect(publicToday.body.data.some((row) => row.id === id)).toBe(true)

    const patchYesterday = await request(app)
      .patch(`/api/v1/admin/catalog/banners/${id}`)
      .set('Cookie', staffCookie)
      .send({ ends_at: yesterday })
    expect(patchYesterday.status).toBe(200)

    const publicAfter = await request(app)
      .get('/api/v1/customer/catalog/banners')
      .set('Cookie', customerCookie)
    expect(publicAfter.body.data.some((row) => row.id === id)).toBe(false)
  })

  it('hides inactive and future-start banners from customer list', async () => {
    const today = dubaiYmd()
    const tomorrow = shiftDubaiYmd(today, 1)

    const inactive = await request(app)
      .post('/api/v1/admin/catalog/banners')
      .set('Cookie', staffCookie)
      .send(toBannerPayload({
        position: 'gifting',
        title: 'Inactive Banner',
        is_active: false,
      }))
    expect(inactive.status).toBe(201)

    const future = await request(app)
      .post('/api/v1/admin/catalog/banners')
      .set('Cookie', staffCookie)
      .send(toBannerPayload({
        position: 'promo_bottom',
        title: 'Future Banner',
        is_active: true,
        starts_at: tomorrow,
        ends_at: shiftDubaiYmd(today, 10),
      }))
    expect(future.status).toBe(201)

    const publicList = await request(app)
      .get('/api/v1/customer/catalog/banners')
      .set('Cookie', customerCookie)
    expect(publicList.status).toBe(200)
    const ids = publicList.body.data.map((row) => row.id)
    expect(ids).not.toContain(inactive.body.data.id)
    expect(ids).not.toContain(future.body.data.id)
  })

  it('paginates admin banners to page 2 with limit 2', async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post('/api/v1/admin/catalog/banners')
        .set('Cookie', staffCookie)
        .send(toBannerPayload({
          position: 'strip',
          title: `Page Banner ${i}`,
          display_order: i,
        }))
      expect(res.status).toBe(201)
    }

    const page2 = await request(app)
      .get('/api/v1/admin/catalog/banners')
      .query({ page: 2, limit: 2 })
      .set('Cookie', staffCookie)
    expect(page2.status).toBe(200)
    expect(page2.body.data).toHaveLength(2)
    expect(page2.body.meta.page).toBe(2)
    expect(page2.body.meta.limit).toBe(2)
    expect(page2.body.meta.total).toBeGreaterThanOrEqual(5)
  })
})

describe('Phase 22.7 certificate contract', () => {
  it('creates with FE payload; rejects mismatch, missing product, unknown fields', async () => {
    const a = await seedProduct('cert-a')
    const b = await seedProduct('cert-b')
    const issued = dubaiYmd()

    const createRes = await request(app)
      .post('/api/v1/admin/catalog/certificates')
      .set('Cookie', staffCookie)
      .send(toCertificatePayload({
        product_id: a.product.id,
        variant_id: null,
        cert_number: 'GIA-998877',
        authority: 'GIA',
        issued_date: issued,
        metadata: { carat: '1.02', color: 'G' },
        file_url: 'https://cdn.example.com/gia.pdf',
      }))
    expect(createRes.status).toBe(201)
    expect(createRes.body.data.product_id).toBe(a.product.id)
    expect(createRes.body.data.variant_id).toBeNull()
    expect(createRes.body.data.cert_number).toBe('GIA-998877')
    expect(createRes.body.data.authority).toBe('GIA')
    expect(createRes.body.data.metadata).toEqual({ carat: '1.02', color: 'G' })
    expect(createRes.body.data.file_url).toBe('https://cdn.example.com/gia.pdf')
    expect(dubaiYmd(new Date(createRes.body.data.issued_date))).toBe(issued)

    const mismatch = await request(app)
      .post('/api/v1/admin/catalog/certificates')
      .set('Cookie', staffCookie)
      .send(toCertificatePayload({
        product_id: a.product.id,
        variant_id: b.variant.id,
        cert_number: 'BAD-VAR',
      }))
    expect(mismatch.status).toBe(422)
    expect(mismatch.body.error.code).toBe('VARIANT_PRODUCT_MISMATCH')

    const missingProduct = await request(app)
      .post('/api/v1/admin/catalog/certificates')
      .set('Cookie', staffCookie)
      .send(toCertificatePayload({
        product_id: new mongoose.Types.ObjectId().toString(),
        cert_number: 'MISSING',
      }))
    expect(missingProduct.status).toBe(404)
    expect(missingProduct.body.error.code).toBe('PRODUCT_NOT_FOUND')

    const unknown = await request(app)
      .post('/api/v1/admin/catalog/certificates')
      .set('Cookie', staffCookie)
      .send({
        ...toCertificatePayload({ product_id: a.product.id, cert_number: 'LEGACY' }),
        certificate_number: 'LEGACY',
      })
    expect(unknown.status).toBe(422)
  })

  it('round-trips issued_date and paginates page 2 for one product', async () => {
    const { product } = await seedProduct('cert-page')
    const issued = '2026-03-15'

    const first = await request(app)
      .post('/api/v1/admin/catalog/certificates')
      .set('Cookie', staffCookie)
      .send(toCertificatePayload({
        product_id: product.id,
        cert_number: 'DATE-1',
        issued_date: issued,
      }))
    expect(first.status).toBe(201)
    expect(dubaiYmd(new Date(first.body.data.issued_date))).toBe(issued)

    for (let i = 0; i < 4; i += 1) {
      const res = await request(app)
        .post('/api/v1/admin/catalog/certificates')
        .set('Cookie', staffCookie)
        .send(toCertificatePayload({
          product_id: product.id,
          cert_number: `PAGE-${i}`,
          authority: 'IGI',
        }))
      expect(res.status).toBe(201)
    }

    const page2 = await request(app)
      .get('/api/v1/admin/catalog/certificates')
      .query({ product_id: product.id, page: 2, limit: 2 })
      .set('Cookie', staffCookie)
    expect(page2.status).toBe(200)
    expect(page2.body.data).toHaveLength(2)
    expect(page2.body.data.every((row) => row.product_id === product.id)).toBe(true)
    expect(page2.body.meta.page).toBe(2)
  })

  it('customer GET returns safe fields only (no storage_key)', async () => {
    const { product } = await seedProduct('cert-public')
    const created = await Certificate.create({
      productId: product.id,
      certNumber: 'PUBLIC-1',
      authority: 'GIA',
      fileUrl: 'https://cdn.example.com/public.pdf',
      storageKey: 'private/certs/secret-key.pdf',
      metadata: { lab: 'NY' },
      issuedDate: new Date('2026-01-10T00:00:00.000+04:00'),
    })

    const res = await request(app)
      .get(`/api/v1/customer/catalog/certificates/${created.id}`)
      .set('Cookie', customerCookie)
    expect(res.status).toBe(200)
    expect(res.body.data.cert_number).toBe('PUBLIC-1')
    expect(res.body.data.authority).toBe('GIA')
    expect(res.body.data.file_url).toBe('https://cdn.example.com/public.pdf')
    expect(res.body.data.storage_key).toBeUndefined()
    expect(res.body.data).not.toHaveProperty('storage_key')
    expect(JSON.stringify(res.body)).not.toContain('secret-key')
  })

  it('applicable_variant_id scopes product-wide + variant; rejects mismatch; paginates page 2', async () => {
    const a = await seedProduct('cert-app-a')
    const b = await seedProduct('cert-app-b')
    const variant2 = await Variant.create({
      productId: a.product.id,
      sku: 'SKU-cert-app-a-2',
      label: '18',
      weightGrams: 5,
      effectiveWeight: 5,
      stockQty: 5,
      purity: '22k',
      isActive: true,
      taxTreatment: 'standard',
    })

    const productWide = await Certificate.create({
      productId: a.product.id,
      variantId: null,
      certNumber: 'WIDE-1',
      authority: 'GIA',
      fileUrl: 'https://cdn.example.com/wide.pdf',
      storageKey: 'private/certs/wide-secret.pdf',
    })
    const forV1 = await Certificate.create({
      productId: a.product.id,
      variantId: a.variant.id,
      certNumber: 'V1-ONLY',
      authority: 'IGI',
    })
    const forV2 = await Certificate.create({
      productId: a.product.id,
      variantId: variant2.id,
      certNumber: 'V2-ONLY',
      authority: 'HRD',
    })
    await Certificate.create({
      productId: b.product.id,
      variantId: null,
      certNumber: 'OTHER-PRODUCT',
      authority: 'SGL',
    })

    const forV1List = await request(app)
      .get('/api/v1/customer/catalog/certificates')
      .query({
        product_id: a.product.id,
        applicable_variant_id: a.variant.id,
        page: 1,
        limit: 50,
      })
      .set('Cookie', customerCookie)
    expect(forV1List.status).toBe(200)
    const v1Nums = forV1List.body.data.map((row) => row.cert_number).sort()
    expect(v1Nums).toEqual(['V1-ONLY', 'WIDE-1'].sort())
    expect(v1Nums).not.toContain('V2-ONLY')
    expect(v1Nums).not.toContain('OTHER-PRODUCT')
    expect(forV1List.body.data.every((row) => row.storage_key === undefined)).toBe(true)
    expect(JSON.stringify(forV1List.body)).not.toContain('wide-secret')

    const forV2List = await request(app)
      .get('/api/v1/customer/catalog/certificates')
      .query({
        product_id: a.product.id,
        applicable_variant_id: variant2.id,
      })
      .set('Cookie', customerCookie)
    expect(forV2List.body.data.map((row) => row.cert_number).sort()).toEqual(['V2-ONLY', 'WIDE-1'].sort())
    expect(forV2List.body.data.map((row) => row.cert_number)).not.toContain('V1-ONLY')

    const productOnly = await request(app)
      .get('/api/v1/customer/catalog/certificates')
      .query({ product_id: a.product.id })
      .set('Cookie', customerCookie)
    expect(productOnly.body.data.map((row) => row.cert_number).sort()).toEqual(
      ['V1-ONLY', 'V2-ONLY', 'WIDE-1'].sort(),
    )

    const mismatch = await request(app)
      .get('/api/v1/customer/catalog/certificates')
      .query({
        product_id: a.product.id,
        applicable_variant_id: b.variant.id,
      })
      .set('Cookie', customerCookie)
    expect(mismatch.status).toBe(422)
    expect(mismatch.body.error.code).toBe('VARIANT_PRODUCT_MISMATCH')

    const missingProduct = await request(app)
      .get('/api/v1/customer/catalog/certificates')
      .query({ page: 1 })
      .set('Cookie', customerCookie)
    expect(missingProduct.status).toBe(422)
    expect(missingProduct.body.error.code).toBe('PRODUCT_ID_REQUIRED')

    // Page-two certificate must be reachable (server pagination, not client filter of page 1).
    for (let i = 0; i < 4; i += 1) {
      await Certificate.create({
        productId: a.product.id,
        variantId: null,
        certNumber: `PAGEFILL-${i}`,
        authority: 'GIA',
      })
    }
    const page2 = await request(app)
      .get('/api/v1/customer/catalog/certificates')
      .query({
        product_id: a.product.id,
        applicable_variant_id: a.variant.id,
        page: 2,
        limit: 2,
      })
      .set('Cookie', customerCookie)
    expect(page2.status).toBe(200)
    expect(page2.body.data).toHaveLength(2)
    expect(page2.body.meta.page).toBe(2)
    expect(page2.body.meta.total).toBeGreaterThan(2)
    expect(page2.body.data.every((row) => {
      const vid = row.variant_id
      return vid == null || vid === a.variant.id
    })).toBe(true)
    expect(page2.body.data.every((row) => row.product_id === a.product.id)).toBe(true)
    void productWide
    void forV1
    void forV2
  })
})

describe('Phase 22.7 CMS contract', () => {
  it('creates with content (not body); rejects empty PATCH and duplicate slug', async () => {
    const payload = toCmsPayload({
      slug: 'shipping-policy',
      title: 'Shipping Policy',
      title_ar: 'الشحن',
      content: '<p>We ship across the UAE.</p>',
      content_ar: '<p>نقوم بالشحن</p>',
      is_published: true,
    })

    const createRes = await request(app)
      .post('/api/v1/admin/catalog/cms-pages')
      .set('Cookie', staffCookie)
      .send(payload)
    expect(createRes.status).toBe(201)
    expect(createRes.body.data.slug).toBe('shipping-policy')
    expect(createRes.body.data.content).toContain('We ship across the UAE')
    expect(createRes.body.data.content_ar).toContain('نقوم بالشحن')
    expect(createRes.body.data).not.toHaveProperty('body')

    const emptyPatch = await request(app)
      .patch(`/api/v1/admin/catalog/cms-pages/${createRes.body.data.id}`)
      .set('Cookie', staffCookie)
      .send({})
    expect(emptyPatch.status).toBe(422)

    const bodyAlias = await request(app)
      .post('/api/v1/admin/catalog/cms-pages')
      .set('Cookie', staffCookie)
      .send({ ...toCmsPayload({ slug: 'with-body', title: 'X', content: '<p>x</p>' }), body: 'legacy' })
    expect(bodyAlias.status).toBe(422)

    const dup = await request(app)
      .post('/api/v1/admin/catalog/cms-pages')
      .set('Cookie', staffCookie)
      .send(toCmsPayload({
        slug: 'shipping-policy',
        title: 'Duplicate',
        content: '<p>dup</p>',
        is_published: false,
      }))
    expect(dup.status).toBe(409)
    expect(dup.body.error.code).toBe('SLUG_CONFLICT')
  })

  it('hides drafts from public list/GET; published GET succeeds', async () => {
    const draft = await request(app)
      .post('/api/v1/admin/catalog/cms-pages')
      .set('Cookie', staffCookie)
      .send(toCmsPayload({
        slug: 'draft-page',
        title: 'Draft',
        content: '<p>Secret draft</p>',
        is_published: false,
      }))
    expect(draft.status).toBe(201)

    const published = await request(app)
      .post('/api/v1/admin/catalog/cms-pages')
      .set('Cookie', staffCookie)
      .send(toCmsPayload({
        slug: 'published-page',
        title: 'Published',
        content: '<p>Public content</p>',
        is_published: true,
      }))
    expect(published.status).toBe(201)

    const list = await request(app)
      .get('/api/v1/customer/catalog/cms-pages')
      .set('Cookie', customerCookie)
    expect(list.status).toBe(200)
    expect(list.body.data.some((row) => row.slug === 'draft-page')).toBe(false)
    expect(list.body.data.some((row) => row.slug === 'published-page')).toBe(true)

    const draftGet = await request(app)
      .get('/api/v1/customer/catalog/cms-pages/draft-page')
      .set('Cookie', customerCookie)
    expect(draftGet.status).toBe(404)

    const pubGet = await request(app)
      .get('/api/v1/customer/catalog/cms-pages/published-page')
      .set('Cookie', customerCookie)
    expect(pubGet.status).toBe(200)
    expect(pubGet.body.data.title).toBe('Published')
    expect(pubGet.body.data.content).toContain('Public content')
  })

  it('sanitizes stored XSS and keeps allowed markup; paginates page 2', async () => {
    const xss = await request(app)
      .post('/api/v1/admin/catalog/cms-pages')
      .set('Cookie', staffCookie)
      .send(toCmsPayload({
        slug: 'xss-page',
        title: 'XSS',
        content: '<script>alert(1)</script><p onclick="x">ok</p><a href="javascript:alert(1)">x</a>',
        is_published: true,
      }))
    expect(xss.status).toBe(201)
    const xssBody = JSON.stringify(xss.body.data)
    expect(xssBody).not.toMatch(/<script/i)
    expect(xssBody).not.toMatch(/onclick/i)
    expect(xssBody).not.toMatch(/javascript:/i)

    const getXss = await request(app)
      .get('/api/v1/admin/catalog/cms-pages/xss-page')
      .set('Cookie', staffCookie)
    expect(getXss.status).toBe(200)
    const getBody = JSON.stringify(getXss.body.data)
    expect(getBody).not.toMatch(/<script/i)
    expect(getBody).not.toMatch(/onclick/i)
    expect(getBody).not.toMatch(/javascript:/i)
    expect(getXss.body.data.content).toContain('ok')

    const safe = await request(app)
      .post('/api/v1/admin/catalog/cms-pages')
      .set('Cookie', staffCookie)
      .send(toCmsPayload({
        slug: 'safe-markup',
        title: 'Safe',
        content: '<p><strong>Hello</strong></p>',
        is_published: true,
      }))
    expect(safe.status).toBe(201)
    expect(safe.body.data.content).toBe('<p><strong>Hello</strong></p>')

    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post('/api/v1/admin/catalog/cms-pages')
        .set('Cookie', staffCookie)
        .send(toCmsPayload({
          slug: `cms-page-${i}`,
          title: `CMS ${i}`,
          content: `<p>Page ${i}</p>`,
          is_published: true,
        }))
    }

    const page2 = await request(app)
      .get('/api/v1/admin/catalog/cms-pages')
      .query({ page: 2, limit: 2 })
      .set('Cookie', staffCookie)
    expect(page2.status).toBe(200)
    expect(page2.body.data).toHaveLength(2)
    expect(page2.body.meta.page).toBe(2)
  })
})

describe('Phase 22.7 product image contract', () => {
  it('creates image; rejects variant/product mismatch and empty/unknown PATCH', async () => {
    const a = await seedProduct('img-a')
    const b = await seedProduct('img-b')

    const createRes = await request(app)
      .post('/api/v1/admin/catalog/images')
      .set('Cookie', staffCookie)
      .send({
        product_id: a.product.id,
        image_url: 'https://cdn.example.com/ring-1.jpg',
        alt_text: 'Front view',
        is_primary: true,
        display_order: 0,
      })
    expect(createRes.status).toBe(201)
    expect(createRes.body.data.product_id).toBe(a.product.id)
    expect(createRes.body.data.image_url).toBe('https://cdn.example.com/ring-1.jpg')
    expect(createRes.body.data.alt_text).toBe('Front view')
    expect(createRes.body.data.is_primary).toBe(true)

    const mismatch = await request(app)
      .post('/api/v1/admin/catalog/images')
      .set('Cookie', staffCookie)
      .send({
        product_id: a.product.id,
        variant_id: b.variant.id,
        image_url: 'https://cdn.example.com/bad.jpg',
        is_primary: false,
      })
    expect(mismatch.status).toBe(422)
    expect(mismatch.body.error.code).toBe('VARIANT_PRODUCT_MISMATCH')

    const emptyPatch = await request(app)
      .patch(`/api/v1/admin/catalog/images/${createRes.body.data.id}`)
      .set('Cookie', staffCookie)
      .send({})
    expect(emptyPatch.status).toBe(422)

    const unknownPatch = await request(app)
      .patch(`/api/v1/admin/catalog/images/${createRes.body.data.id}`)
      .set('Cookie', staffCookie)
      .send({ unknown_field: true, alt_text: 'x' })
    expect(unknownPatch.status).toBe(422)
  })

  it('concurrent set-primary leaves exactly one primary', async () => {
    const { product } = await seedProduct('img-primary')
    const img1 = await request(app)
      .post('/api/v1/admin/catalog/images')
      .set('Cookie', staffCookie)
      .send({
        product_id: product.id,
        image_url: 'https://cdn.example.com/a.jpg',
        display_order: 0,
        is_primary: true,
      })
    const img2 = await request(app)
      .post('/api/v1/admin/catalog/images')
      .set('Cookie', staffCookie)
      .send({
        product_id: product.id,
        image_url: 'https://cdn.example.com/b.jpg',
        display_order: 1,
        is_primary: false,
      })
    expect(img1.status).toBe(201)
    expect(img2.status).toBe(201)

    const results = await Promise.all([
      request(app)
        .post(`/api/v1/admin/catalog/images/${img1.body.data.id}/set-primary`)
        .set('Cookie', staffCookie)
        .send({}),
      request(app)
        .post(`/api/v1/admin/catalog/images/${img2.body.data.id}/set-primary`)
        .set('Cookie', staffCookie)
        .send({}),
    ])
    expect(results.every((r) => r.status === 200)).toBe(true)

    const rows = await ProductImage.find({ productId: product.id })
    expect(rows.filter((row) => row.isPrimary)).toHaveLength(1)
  })

  it('deleting primary promotes lowest display_order remaining', async () => {
    const { product } = await seedProduct('img-promote')
    const primary = await request(app)
      .post('/api/v1/admin/catalog/images')
      .set('Cookie', staffCookie)
      .send({
        product_id: product.id,
        image_url: 'https://cdn.example.com/p0.jpg',
        display_order: 0,
        is_primary: true,
      })
    const mid = await request(app)
      .post('/api/v1/admin/catalog/images')
      .set('Cookie', staffCookie)
      .send({
        product_id: product.id,
        image_url: 'https://cdn.example.com/p2.jpg',
        display_order: 2,
        is_primary: false,
      })
    const low = await request(app)
      .post('/api/v1/admin/catalog/images')
      .set('Cookie', staffCookie)
      .send({
        product_id: product.id,
        image_url: 'https://cdn.example.com/p1.jpg',
        display_order: 1,
        is_primary: false,
      })
    expect(primary.status).toBe(201)
    expect(mid.status).toBe(201)
    expect(low.status).toBe(201)

    const del = await request(app)
      .delete(`/api/v1/admin/catalog/images/${primary.body.data.id}`)
      .set('Cookie', staffCookie)
    expect(del.status).toBe(204)

    const remaining = await ProductImage.find({ productId: product.id }).sort({ displayOrder: 1 })
    expect(remaining).toHaveLength(2)
    const primaries = remaining.filter((row) => row.isPrimary)
    expect(primaries).toHaveLength(1)
    expect(String(primaries[0].id)).toBe(String(low.body.data.id))
    expect(primaries[0].displayOrder).toBe(1)
  })
})
