import { describe, expect, it } from 'vitest'
import { toProductPayload, PRODUCT_DB_FIELDS } from './productDefaults'
import { toCategoryPayload, toBrandPayload, CATEGORY_DB_FIELDS, BRAND_DB_FIELDS } from './catalogPayloads'

describe('Phase 22 frontend catalog payloads', () => {
  it('toProductPayload emits exact API snake_case contract fields', () => {
    const payload = toProductPayload({
      category_id: '507f1f77bcf86cd799439011',
      brand_id: '507f1f77bcf86cd799439012',
      name: 'Ring',
      name_ar: 'خاتم',
      slug: 'ring',
      description: 'd',
      description_ar: 'وصف',
      short_desc: 'short',
      short_desc_ar: 'قصير',
      metal_type: 'gold',
      metal_color: 'yellow',
      purity: '22k',
      gender: 'unisex',
      occasion: ['daily'],
      making_charge_type: 'percent',
      making_charge_value: 10,
      wastage_percent: 2,
      tax_treatment: 'standard',
      status: 'draft',
      is_featured: true,
      display_order: 3,
      is_customizable: true,
      customization_note: 'note',
      video_url: 'should-not-appear',
    })

    expect(Object.keys(payload).sort()).toEqual([...PRODUCT_DB_FIELDS].sort())
    expect(payload).toEqual({
      category_id: '507f1f77bcf86cd799439011',
      brand_id: '507f1f77bcf86cd799439012',
      name: 'Ring',
      name_ar: 'خاتم',
      slug: 'ring',
      description: 'd',
      description_ar: 'وصف',
      short_description: 'short',
      short_description_ar: 'قصير',
      metal_type: 'gold',
      metal_color: 'yellow',
      purity: '22k',
      gender: 'unisex',
      occasion: ['daily'],
      making_charge_type: 'percent',
      making_charge_value: 10,
      wastage_percent: 2,
      tax_treatment: 'standard',
      status: 'draft',
      is_featured: true,
      display_order: 3,
      is_customizable: true,
      customization_note: 'note',
    })
    expect(payload.video_url).toBeUndefined()
  })

  it('toCategoryPayload emits CategoryFormDialog contract fields', () => {
    const payload = toCategoryPayload({
      name: 'Rings',
      name_ar: 'خواتم',
      slug: 'rings',
      description: 'desc',
      description_ar: 'وصف',
      parent_id: '',
      image_url: 'https://cdn.example.com/c.jpg',
      display_order: '5',
      is_active: true,
      id: 'should-not-be-required',
    })

    expect(Object.keys(payload).sort()).toEqual([...CATEGORY_DB_FIELDS].sort())
    expect(payload.parent_id).toBeNull()
    expect(payload.display_order).toBe(5)
    expect(payload.id).toBeUndefined()
  })

  it('toBrandPayload emits BrandFormDialog contract fields including responsive URLs', () => {
    const payload = toBrandPayload({
      name: '  Maison  ',
      name_ar: 'ميزون',
      slug: 'maison',
      description: 'en',
      description_ar: 'عربي',
      logo_desktop_url: 'https://cdn.example.com/ld.png',
      logo_tablet_url: 'https://cdn.example.com/lt.png',
      logo_mobile_url: 'https://cdn.example.com/lm.png',
      banner_desktop_url: 'https://cdn.example.com/bd.png',
      banner_tablet_url: 'https://cdn.example.com/bt.png',
      banner_mobile_url: 'https://cdn.example.com/bm.png',
      display_order: '2',
      is_active: true,
      id: 'omit-me',
      created_at: 'omit-me',
    })

    expect(payload.name).toBe('Maison')
    expect(payload.description_ar).toBe('عربي')
    expect(payload.logo_desktop_url).toBe('https://cdn.example.com/ld.png')
    expect(payload.banner_mobile_url).toBe('https://cdn.example.com/bm.png')
    expect(payload.id).toBeUndefined()
    expect(payload.created_at).toBeUndefined()
    expect(payload.logo_url).toBeUndefined()
    for (const key of BRAND_DB_FIELDS) {
      if (key === 'logo_url') continue
      expect(payload).toHaveProperty(key)
    }
  })
})
