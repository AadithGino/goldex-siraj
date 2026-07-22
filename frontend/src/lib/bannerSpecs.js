/**
 * Banner sections, their recommended creative sizes, and the exact aspect ratio
 * each one renders at. The storefront and the admin preview BOTH read aspectClass
 * from here, so "the size we ask for" always equals "the size that displays".
 *
 * `position` in the DB is free text, so adding a section here needs no migration.
 */

export const BANNER_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'
export const BANNER_IMAGE_MAX_MB = 5

export const BANNER_SPECS = {
  // Full-width hero carousel (top of home)
  hero: {
    label: 'Hero carousel',
    group: 'Home — top',
    columns: 1,
    gridClass: 'grid-cols-1',
    aspectClass: 'aspect-[16/9] sm:aspect-[24/9]',
    desktopAspect: 'aspect-[24/9]',
    mobileAspect: 'aspect-[16/9]',
    desktop: { width: 1920, height: 720, ratio: '24:9' },
    mobile: { width: 1080, height: 608, ratio: '16:9' },
  },

  // Thin full-width promo strip just under the hero (e.g. festival / shipping offer)
  strip: {
    label: 'Slim promo strip',
    group: 'Home — top',
    columns: 1,
    gridClass: 'grid-cols-1',
    aspectClass: 'aspect-[4/1] sm:aspect-[8/1]',
    desktopAspect: 'aspect-[8/1]',
    mobileAspect: 'aspect-[4/1]',
    desktop: { width: 1920, height: 240, ratio: '8:1' },
    mobile: { width: 1080, height: 270, ratio: '4:1' },
  },

  // 3-up horizontal collection cards ("Shop by Collection")
  collection: {
    label: 'Collection cards (3-up)',
    group: 'Home — mid',
    columns: 3,
    gridClass: 'grid-cols-2 sm:grid-cols-3',
    aspectClass: 'aspect-[16/9]',
    desktopAspect: 'aspect-[16/9]',
    mobileAspect: 'aspect-[16/9]',
    desktop: { width: 960, height: 540, ratio: '16:9' },
    mobile: { width: 1080, height: 608, ratio: '16:9' },
  },

  // 2-up compact offer cards
  promo_top: {
    label: 'Offer cards (2-up)',
    group: 'Home — mid',
    columns: 2,
    gridClass: 'grid-cols-1 sm:grid-cols-2',
    aspectClass: 'aspect-[5/3]',
    desktopAspect: 'aspect-[5/3]',
    mobileAspect: 'aspect-[5/3]',
    desktop: { width: 960, height: 576, ratio: '5:3' },
    mobile: { width: 1080, height: 648, ratio: '5:3' },
  },

  // Full-width mid-page campaign band (was "deal" — now actually rendered)
  deal: {
    label: 'Mid-page wide banner',
    group: 'Home — mid',
    columns: 1,
    gridClass: 'grid-cols-1',
    aspectClass: 'aspect-[2/1] sm:aspect-[4/1]',
    desktopAspect: 'aspect-[4/1]',
    mobileAspect: 'aspect-[2/1]',
    desktop: { width: 1920, height: 480, ratio: '4:1' },
    mobile: { width: 1080, height: 540, ratio: '2:1' },
  },

  // 2-up gifting / occasion banners
  gifting: {
    label: 'Gifting banners (2-up)',
    group: 'Home — lower',
    columns: 2,
    gridClass: 'grid-cols-1 sm:grid-cols-2',
    aspectClass: 'aspect-[16/9]',
    desktopAspect: 'aspect-[16/9]',
    mobileAspect: 'aspect-[16/9]',
    desktop: { width: 960, height: 540, ratio: '16:9' },
    mobile: { width: 1080, height: 608, ratio: '16:9' },
  },

  // Full-width feature banner near the bottom
  promo_bottom: {
    label: 'Feature banner (full width)',
    group: 'Home — lower',
    columns: 1,
    gridClass: 'grid-cols-1',
    aspectClass: 'aspect-[2/1] sm:aspect-[21/8]',
    desktopAspect: 'aspect-[21/8]',
    mobileAspect: 'aspect-[2/1]',
    desktop: { width: 1920, height: 731, ratio: '21:8' },
    mobile: { width: 1080, height: 540, ratio: '2:1' },
  },
}

/** Order shown in the admin dropdown. */
export const BANNER_POSITIONS = [
  'hero',
  'strip',
  'collection',
  'promo_top',
  'deal',
  'gifting',
  'promo_bottom',
]

export function getBannerSpec(position) {
  return BANNER_SPECS[position] || BANNER_SPECS.hero
}

export function formatBannerSize({ width, height, ratio }) {
  return `${width} × ${height} px (${ratio})`
}
