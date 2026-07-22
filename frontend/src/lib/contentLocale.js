import i18n from '@/i18n'

/** Content language for DB-backed fields: 'ar' | 'en' */
export function getContentLang(lng = i18n.language) {
  return lng?.startsWith('ar') ? 'ar' : 'en'
}

export function pickField(record, field, lang = getContentLang()) {
  if (lang === 'ar') {
    const ar = record?.[`${field}_ar`]
    if (ar?.trim?.()) return ar
  }
  return record?.[field] ?? ''
}

export function localizeRecord(record, fields, lang = getContentLang()) {
  if (!record) return {}
  return Object.fromEntries(fields.map((f) => [f, pickField(record, f, lang)]))
}

export function hasArabicContent(record, fields = []) {
  if (!record || !Array.isArray(fields) || fields.length === 0) return false
  return fields.some((f) => record[`${f}_ar`]?.trim?.())
}

export function pickBannerImages(banner, lang = getContentLang()) {
  if (lang === 'ar' && banner?.image_url_ar) {
    return {
      desktop: banner.image_url_ar,
      mobile: banner.mobile_image_url_ar || banner.image_url_ar,
    }
  }
  return {
    desktop: banner?.image_url,
    mobile: banner?.mobile_image_url || banner?.image_url,
  }
}

export function pickBannerTitle(banner, lang = getContentLang()) {
  if (lang === 'ar' && banner?.title_ar?.trim?.()) return banner.title_ar
  return banner?.title || 'Banner'
}

/** Localize common product display fields on a product record */
export function localizeProduct(product, lang = getContentLang()) {
  if (!product) return product
  return {
    ...product,
    ...localizeRecord(product, ['name', 'short_desc', 'description', 'customization_note'], lang),
  }
}

export function localizeCategory(category, lang = getContentLang()) {
  if (!category) return category
  return {
    ...category,
    ...localizeRecord(category, ['name', 'description'], lang),
  }
}

export function localizeCmsPage(page, lang = getContentLang()) {
  if (!page) return page
  return {
    ...page,
    ...localizeRecord(page, ['title', 'content'], lang),
  }
}

export function localizeScheme(scheme, lang = getContentLang()) {
  if (!scheme) return scheme
  return {
    ...scheme,
    ...localizeRecord(scheme, ['name', 'description'], lang),
  }
}
