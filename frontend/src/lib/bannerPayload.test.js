import { describe, expect, it } from 'vitest'
import { BannerPayloadError, bannerDateToInput, toBannerPayload } from './bannerPayload'

describe('toBannerPayload', () => {
  const base = {
    position: 'hero',
    title: 'Eid Edit',
    title_ar: 'عيد',
    subtitle: 'Shop',
    subtitle_ar: null,
    eyebrow: 'New',
    eyebrow_ar: null,
    image_url: 'https://cdn.example.com/d.jpg',
    image_url_ar: null,
    mobile_image_url: 'https://cdn.example.com/m.jpg',
    mobile_image_url_ar: null,
    cta_text: 'Shop',
    cta_text_ar: null,
    cta_link: '/collections/eid',
    display_order: 2,
    is_active: true,
    starts_at: '2026-07-01',
    ends_at: '2026-07-31',
  }

  it('emits canonical snake_case FE contract', () => {
    expect(toBannerPayload(base)).toEqual({
      position: 'hero',
      title: 'Eid Edit',
      title_ar: 'عيد',
      subtitle: 'Shop',
      subtitle_ar: null,
      eyebrow: 'New',
      eyebrow_ar: null,
      image_url: 'https://cdn.example.com/d.jpg',
      image_url_ar: null,
      mobile_image_url: 'https://cdn.example.com/m.jpg',
      mobile_image_url_ar: null,
      cta_text: 'Shop',
      cta_text_ar: null,
      cta_link: '/collections/eid',
      display_order: 2,
      is_active: true,
      starts_at: '2026-07-01',
      ends_at: '2026-07-31',
    })
  })

  it('accepts all known positions and rejects unknown', () => {
    for (const position of ['hero', 'strip', 'collection', 'promo_top', 'deal', 'gifting', 'promo_bottom']) {
      expect(toBannerPayload({ ...base, position }).position).toBe(position)
    }
    expect(() => toBannerPayload({ ...base, position: 'sidebar' })).toThrow(BannerPayloadError)
  })

  it('rejects invalid display_order and date order', () => {
    expect(() => toBannerPayload({ ...base, display_order: 1.5 })).toThrow(/display_order/)
    expect(() => toBannerPayload({ ...base, display_order: 'abc' })).toThrow(/display_order/)
    expect(() => toBannerPayload({
      ...base,
      starts_at: '2026-08-01',
      ends_at: '2026-07-01',
    })).toThrow(/starts_at/)
    expect(() => toBannerPayload({ ...base, starts_at: '07/01/2026' })).toThrow(/YYYY-MM-DD/)
  })

  it('partial update requires at least one field', () => {
    expect(() => toBannerPayload({}, { partial: true })).toThrow(/At least one field/)
    expect(toBannerPayload({ is_active: false }, { partial: true })).toEqual({ is_active: false })
  })
})

describe('bannerDateToInput', () => {
  it('maps UTC instant to Dubai YYYY-MM-DD', () => {
    // 2026-07-20T20:00Z = midnight Jul 21 Dubai
    expect(bannerDateToInput('2026-07-20T20:00:00.000Z')).toBe('2026-07-21')
    expect(bannerDateToInput(null)).toBe('')
  })
})
