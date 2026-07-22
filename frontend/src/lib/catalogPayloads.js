/** Category admin form → API payload (exact contract fields). */
export const CATEGORY_DB_FIELDS = [
  'name',
  'name_ar',
  'slug',
  'description',
  'description_ar',
  'parent_id',
  'image_url',
  'display_order',
  'is_active',
]

export function toCategoryPayload(input = {}) {
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

/** Brand admin form → API payload (exact contract fields). */
export const BRAND_DB_FIELDS = [
  'name',
  'name_ar',
  'slug',
  'description',
  'description_ar',
  'logo_url',
  'logo_desktop_url',
  'logo_tablet_url',
  'logo_mobile_url',
  'banner_desktop_url',
  'banner_tablet_url',
  'banner_mobile_url',
  'display_order',
  'is_active',
]

export function toBrandPayload(input = {}) {
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
  // Retain legacy logo_url only when explicitly present (do not invent from responsive URLs).
  if (Object.prototype.hasOwnProperty.call(input, 'logo_url')) {
    payload.logo_url = input.logo_url || null
  }
  return payload
}

/** Prefer responsive logo; fall back to legacy logo_url. */
export function brandLogoUrl(brand) {
  if (!brand) return null
  return (
    brand.logo_mobile_url
    || brand.logo_tablet_url
    || brand.logo_desktop_url
    || brand.logo_url
    || null
  )
}

/** Prefer responsive banner; no legacy banner field. */
export function brandBannerUrl(brand) {
  if (!brand) return null
  return brand.banner_desktop_url || brand.banner_tablet_url || brand.banner_mobile_url || null
}
