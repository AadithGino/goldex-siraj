import { normalizeGender, getGenderLabel, getSizeTypeMeta } from '@/lib/i18nLabels'

export const OCCASIONS = [
  { key: 'bridal', label: 'Bridal' },
  { key: 'daily', label: 'Daily Wear' },
  { key: 'gift', label: 'Gifting' },
  { key: 'festive', label: 'Festive' },
  { key: 'office', label: 'Office' },
]

export const PURITIES = ['14k', '18k', '21k', '22k', '24k']

export const METAL_COLORS = [
  { value: 'yellow', label: 'Yellow' },
  { value: 'white', label: 'White' },
  { value: 'rose', label: 'Rose' },
]

/** Product audience — stored on `products.gender` (English labels for admin) */
export const GENDERS = [
  { value: 'unisex', label: 'Unisex' },
  { value: 'male', label: 'Men' },
  { value: 'female', label: 'Women' },
  { value: 'boys', label: 'Boys' },
  { value: 'girls', label: 'Girls' },
  { value: 'infant', label: 'Infant' },
]

export { normalizeGender, getGenderLabel }

/** Metal weight ranges (variant `weight_grams`) for storefront filters */
export const WEIGHT_PRESETS = [
  { label: 'Under 5 g', min: null, max: 5 },
  { label: '5 g – 10 g', min: 5, max: 10 },
  { label: '10 g – 20 g', min: 10, max: 20 },
  { label: '20 g – 30 g', min: 20, max: 30 },
  { label: '30 g – 50 g', min: 30, max: 50 },
  { label: 'Over 50 g', min: 50, max: null },
]

export function extractAvailableGenders(products = []) {
  const set = new Set()
  for (const p of products) {
    if (p.gender) set.add(normalizeGender(p.gender))
  }
  return GENDERS.filter((g) => set.has(g.value))
}

export const STONE_SHAPES = [
  'Round',
  'Oval',
  'Pear',
  'Marquise',
  'Princess',
  'Emerald',
  'Cushion',
  'Baguette',
  'Other',
]

export const SETTING_TYPES = [
  'Cap',
  'Prong',
  'Bezel',
  'Pave',
  'Channel',
  'Flush',
  'Other',
]

/** Display label e.g. 14k → 14Kt Gold — storefront: use formatMetalTypeLabel(purity, metal, t) from i18nLabels */
export { formatMetalTypeLabel } from '@/lib/i18nLabels'

export const SIZE_TYPES = [
  { value: 'ring', label: 'Ring' },
  { value: 'necklace', label: 'Necklace / chain' },
  { value: 'bangle', label: 'Bangle' },
  { value: 'bracelet', label: 'Bracelet' },
  { value: 'earring', label: 'Earring' },
  { value: 'pendant', label: 'Pendant' },
  { value: 'other', label: 'Other' },
]

/** Predefined selectable sizes per jewellery type */
export const SIZE_OPTIONS = {
  ring: ['6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'],
  necklace: ['14 inch', '16 inch', '18 inch', '20 inch', '22 inch', '24 inch', '30 inch'],
  bangle: ['2.2', '2.4', '2.6', '2.8', '2.10'],
  bracelet: ['6 inch', '6.5 inch', '7 inch', '7.5 inch', '8 inch'],
  earring: ['Single', 'Pair'],
  pendant: ['Mini', 'Small', 'Medium', 'Large'],
  other: ['One size', 'Adjustable', 'Custom'],
}

export function getSizeOptions(sizeType) {
  return SIZE_OPTIONS[sizeType] || SIZE_OPTIONS.other
}

export function formatSizeFilterKey(sizeType, size) {
  return `${sizeType}:${size}`
}

export function parseSizeFilterKey(key) {
  const [sizeType, ...rest] = key.split(':')
  return { sizeType, size: rest.join(':') }
}

export const STONE_TYPES = [
  { value: 'none', label: 'No stone' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'emerald', label: 'Emerald' },
  { value: 'sapphire', label: 'Sapphire' },
  { value: 'pearl', label: 'Pearl' },
  { value: 'moissanite', label: 'Moissanite' },
  { value: 'cubic_zirconia', label: 'Cubic zirconia' },
  { value: 'other', label: 'Other' },
]

export const STONE_PURITIES = [
  { value: 'VVS', label: 'VVS' },
  { value: 'VS', label: 'VS' },
  { value: 'SI', label: 'SI' },
  { value: 'I', label: 'I' },
  { value: 'IF', label: 'IF (Internally flawless)' },
  { value: 'AAA', label: 'AAA' },
  { value: 'AA', label: 'AA' },
  { value: 'A', label: 'A' },
  { value: 'other', label: 'Other / mixed' },
]

export { getSizeTypeMeta }

export function getStoneTypeLabel(value) {
  if (!value || value === 'none') return null
  return STONE_TYPES.find((t) => t.value === value)?.label || value
}

export function formatVariantSize(variant) {
  if (!variant) return null
  const meta = getSizeTypeMeta(variant.size_type)
  if (variant.size) return `${meta.label}: ${variant.size}`
  return meta.label
}

/** Build filter options from loaded product catalogue */
export function extractCatalogFilterOptions(products = []) {
  const sizeTypes = new Set()
  const sizes = new Set()
  const stoneTypes = new Set()

  for (const product of products) {
    for (const v of product.product_variants || []) {
      if (v.size_type) sizeTypes.add(v.size_type)
      if (v.size_type && v.size) sizes.add(formatSizeFilterKey(v.size_type, v.size))
      if (v.stone_type && v.stone_type !== 'none') stoneTypes.add(v.stone_type)
    }
  }

  return {
    sizeTypes: SIZE_TYPES.filter((t) => sizeTypes.has(t.value)),
    sizes: [...sizes].sort(),
    stoneTypes: [...stoneTypes].sort(),
  }
}

/** Narrow products used to build size/stone filter chips (by category) */
export function getProductsForFilterOptions(products = [], filters = {}) {
  let scoped = products
  if (filters.categoryId) {
    scoped = scoped.filter((p) => p.category_id === filters.categoryId)
  }
  if (filters.brandId) {
    scoped = scoped.filter((p) => p.brand_id === filters.brandId)
  }
  return scoped
}

/** Drop size/stone selections that no longer exist in the scoped catalogue */
export function syncVariantFilters(filters, catalogOptions) {
  const validSizes = new Set(catalogOptions.sizes)
  const validStones = new Set(catalogOptions.stoneTypes)

  return {
    ...filters,
    sizes: (filters.sizes || []).filter((s) => validSizes.has(s)),
    stoneTypes: (filters.stoneTypes || []).filter((s) => validStones.has(s)),
  }
}

/** Checkout: online payment instruments common in UAE */
export const UAE_ONLINE_PAYMENT_MODES = [
  { value: 'card', label: 'Card Payment' },
]

export const PAYMENT_MODE_LABELS = {
  cash: 'Cash',
  cash_on_delivery: 'Cash on delivery',
  card: 'Card',
  debit_card: 'Debit Card',
  credit_card: 'Credit Card',
  apple_pay: 'Online Payment',
  google_pay: 'Online Payment',
  samsung_pay: 'Online Payment',
  tabby: 'Secure online payment',
  tamara: 'Secure online payment',
  bank_transfer: 'Bank transfer',
}

export const PAYMENT_METHOD_LABELS = {
  cod: 'Cash on Delivery',
  manual: 'Bank/card transfer',
  online: 'Online Payment',
}

export const PAYMENT_STATUS_LABELS = {
  pending: 'Payment pending',
  paid: 'Paid',
  cod_pending: 'Pay on delivery',
  failed: 'Failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
}

export const PAYMENT_PROVIDER_LABELS = {
  demo: 'Demo gateway',
  checkout_com: 'Checkout.com',
  telr: 'Telr',
  stripe: 'Stripe',
  network: 'Network International',
  paytabs: 'PayTabs',
}

export function getPaymentModeLabel(mode) {
  if (!mode) return '—'
  return PAYMENT_MODE_LABELS[mode] || mode
}

export const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' },
]

export { STORE_BRAND, STORE_LEGAL_NAME_EN as STORE_NAME, STORE_EMAIL, STORE_COMPLIANCE_EMAIL, getStoreLegalName } from '@/lib/storeIdentity'

/** Storefront: use getOrderStatusLabel(status, t) from @/lib/i18nLabels for translated labels */
export const ORDER_STATUS_LABELS = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
}

export const ORDER_STATUS_VARIANT = {
  placed: 'outline',
  confirmed: 'outline',
  processing: 'outline',
  shipped: 'gold',
  delivered: 'success',
  cancelled: 'destructive',
  returned: 'destructive',
}

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi',
]

/** Storefront label helpers — pass `t` from useTranslation for localized strings */
export {
  getOccasions,
  getGenders,
  getWeightPresets,
  getSizeTypes,
  getSortOptions,
  getUaeOnlinePaymentModes,
  getOrderStatusLabel,
  getAddressLabels,
} from '@/lib/i18nLabels'
