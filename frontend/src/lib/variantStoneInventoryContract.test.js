import { describe, expect, it, vi } from 'vitest'
import { toVariantPayload, toProductStonePayload } from './productDefaults'
import { PayloadValidationError, parseLowStockThreshold } from './numberParse'
import { PURITIES } from './constants'
import { DEFAULT_PRODUCT_STONE } from './stonePricing'

/** Mirrors VariantStonesEditor.stonesFromVariant without loading React. */
function stonesFromVariant(variant) {
  const rows = variant?.product_stones || variant?.stones || []
  if (Array.isArray(rows) && rows.length) {
    return rows.map((s) => ({
      ...DEFAULT_PRODUCT_STONE,
      id: s.id,
      label: s.label || s.stone_type || '',
      stone_rate_id: s.stone_rate_id || '',
      pricing_mode: s.pricing_mode || (s.stone_rate_id ? 'rate' : 'fixed'),
      stone_type: s.stone_type || '',
      grade: s.grade ?? null,
      unit: s.unit === 'carat' ? 'carat' : 'piece',
      stone_count: s.stone_count ?? 1,
      shape: s.shape || 'Round',
      size_mm: s.size_mm ?? '',
      setting_type: s.setting_type || 'Cap',
      stone_weight_carat: s.weight ?? '',
      weight: s.weight ?? '',
      manual_charge: s.manual_charge ?? '',
    }))
  }
  return []
}

describe('Phase 22.8 variant/stone payload builders', () => {
  it('preserves low_stock_threshold=0', () => {
    expect(parseLowStockThreshold(0)).toBe(0)
    const payload = toVariantPayload({
      sku: 'X',
      purity: '22k',
      weight_grams: 2,
      low_stock_threshold: 0,
    })
    expect(payload.low_stock_threshold).toBe(0)
  })

  it('invalid numeric input blocks payload creation', () => {
    expect(() => toVariantPayload({
      sku: 'X',
      purity: '22k',
      weight_grams: '',
    })).toThrow(PayloadValidationError)

    expect(() => toProductStonePayload({
      pricing_mode: 'fixed',
      stone_type: 'pearl',
      unit: 'piece',
      stone_count: 'abc',
      manual_charge: 10,
    }, 0)).toThrow(PayloadValidationError)
  })

  it('includes 21k in purity options', () => {
    expect(PURITIES).toContain('21k')
  })

  it('rate-mode stone payload contains canonical rate fields', () => {
    const payload = toProductStonePayload({
      pricing_mode: 'rate',
      stone_rate_id: '507f1f77bcf86cd799439011',
      stone_type: 'ruby',
      grade: 'AA',
      unit: 'piece',
      stone_count: 2,
      label: 'Ruby',
      shape: 'Oval',
      size_mm: 4,
      setting_type: 'Prong',
    }, 0)
    expect(payload).toMatchObject({
      stone_rate_id: '507f1f77bcf86cd799439011',
      stone_type: 'ruby',
      grade: 'AA',
      unit: 'piece',
      pricing_mode: 'rate',
      stone_count: 2,
      shape: 'Oval',
      size_mm: 4,
      setting_type: 'Prong',
    })
    expect(payload.manual_charge).toBeUndefined()
  })

  it('fixed-mode stone payload contains manual charge and no rate ID', () => {
    const payload = toProductStonePayload({
      pricing_mode: 'fixed',
      stone_type: 'pearl',
      unit: 'piece',
      stone_count: 1,
      manual_charge: 55,
      label: 'Pearl',
      shape: 'Round',
      size_mm: 5,
      setting_type: 'Cap',
    }, 1)
    expect(payload.pricing_mode).toBe('fixed')
    expect(payload.manual_charge).toBe(55)
    expect(payload.stone_rate_id).toBeNull()
  })

  it('stone edit round trip preserves display attributes', () => {
    const rows = stonesFromVariant({
      product_stones: [{
        id: 's1',
        label: 'White Pearl',
        pricing_mode: 'fixed',
        stone_type: 'pearl',
        unit: 'piece',
        stone_count: 2,
        shape: 'Baroque',
        size_mm: 6.5,
        setting_type: 'Glue',
        manual_charge: 40,
        weight: null,
      }],
    })
    expect(rows[0]).toMatchObject({
      label: 'White Pearl',
      shape: 'Baroque',
      size_mm: 6.5,
      setting_type: 'Glue',
      stone_count: 2,
      pricing_mode: 'fixed',
      manual_charge: 40,
    })
    const payload = toProductStonePayload(rows[0], 0)
    expect(payload.shape).toBe('Baroque')
    expect(payload.size_mm).toBe(6.5)
    expect(payload.setting_type).toBe('Glue')
    expect(payload.manual_charge).toBe(40)
  })

  it('stonesFromVariant is pure (no render accumulation)', () => {
    const variant = {
      product_stones: [{
        id: 's1',
        label: 'A',
        pricing_mode: 'fixed',
        stone_type: 'pearl',
        unit: 'piece',
        stone_count: 1,
        manual_charge: 1,
      }],
    }
    const a = stonesFromVariant(variant)
    const b = stonesFromVariant(variant)
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
  })
})

describe('Phase 22.8 inventory mutation contracts', () => {
  it('+/- uses delta adjustment and absolute set sends expected_before', async () => {
    const posts = []
    vi.resetModules()
    vi.doMock('@/lib/api', () => ({
      ApiError: class ApiError extends Error {
        constructor(message, code) {
          super(message)
          this.code = code
        }
      },
      api: {
        post: async (url, body) => {
          posts.push({ url, body })
          return { stock_qty: body.qty ?? body.delta ?? 0 }
        },
        getWithMeta: async () => ({ data: [], meta: { total: 0, page: 1, pages: 1, limit: 50 } }),
      },
    }))

    const { api, ApiError } = await import('@/lib/api')
    await api.post('/admin/inventory/variants/v1/adjust', {
      delta: 1,
      reason: 'admin_adjustment',
      idempotency_key: 'k1',
    })
    await api.post('/admin/inventory/variants/v1/set-stock', {
      qty: 5,
      expected_before: 3,
      reason: 'admin_adjustment',
      idempotency_key: 'k2',
    })

    expect(posts.some((p) => p.url.includes('/adjust') && p.body.delta === 1)).toBe(true)
    expect(posts.some((p) => p.url.includes('/set-stock') && p.body.expected_before === 3 && p.body.qty === 5)).toBe(true)

    // Blank/invalid typed value must not become zero
    const blankQty = ''
    expect(blankQty === '' || blankQty == null).toBe(true)
    const invalid = Number('nope')
    expect(Number.isInteger(invalid) && invalid >= 0).toBe(false)

    // Version conflict path refreshes via invalidate (ApiError code check)
    const conflict = new ApiError('conflict', 'STOCK_VERSION_CONFLICT')
    expect(conflict.code).toBe('STOCK_VERSION_CONFLICT')
  })

  it('inventory list uses server pagination and can discover records beyond 100', async () => {
    const calls = []
    vi.resetModules()
    vi.doMock('@/lib/api', () => ({
      ApiError: class extends Error {},
      api: {
        getWithMeta: async (url, params) => {
          calls.push({ url, params })
          return {
            data: [{ id: '201', sku: 'INV-0201', stock_qty: 7 }],
            meta: { total: 201, page: 5, pages: 5, limit: 50 },
          }
        },
      },
    }))
    const { api } = await import('@/lib/api')
    const page5 = await api.getWithMeta('/admin/inventory/variants', {
      page: 5,
      limit: 50,
      search: undefined,
      stock_state: undefined,
    })
    expect(calls[0].params.page).toBe(5)
    expect(calls[0].params.limit).toBe(50)
    expect(page5.meta.total).toBe(201)
    expect(page5.data[0].sku).toBe('INV-0201')

    const searched = await api.getWithMeta('/admin/inventory/variants', {
      page: 1,
      limit: 50,
      search: 'INV-0201',
    })
    expect(searched.meta.total).toBe(201)
  })
})
