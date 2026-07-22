import i18n from '@/i18n'
import { formatAED } from '@/lib/pricing'

/** Translation helpers for shared libs (call at render time, not module init). */

export function getOccasions(t = i18n.t.bind(i18n)) {
  return [
    { key: 'bridal', label: t('common:occasion.bridal') },
    { key: 'daily', label: t('common:occasion.daily') },
    { key: 'gift', label: t('common:occasion.gift') },
    { key: 'festive', label: t('common:occasion.festive') },
    { key: 'office', label: t('common:occasion.office') },
  ]
}

export function getGenders(t = i18n.t.bind(i18n)) {
  return [
    { value: 'unisex', label: t('common:gender.unisex') },
    { value: 'male', label: t('common:gender.male') },
    { value: 'female', label: t('common:gender.female') },
    { value: 'boys', label: t('common:gender.boys') },
    { value: 'girls', label: t('common:gender.girls') },
    { value: 'infant', label: t('common:gender.infant') },
  ]
}

const GENDER_LEGACY_MAP = {
  women: 'female',
  men: 'male',
  kids: 'kids',
}

export function normalizeGender(value) {
  if (!value) return 'unisex'
  return GENDER_LEGACY_MAP[value] || value
}

export function getGenderLabel(value, t = i18n.t.bind(i18n)) {
  const normalized = normalizeGender(value)
  const match = getGenders(t).find((g) => g.value === normalized)
  if (match) return match.label
  if (normalized === 'kids') return t('common:gender.kids')
  return value
}

export function getWeightPresets(t = i18n.t.bind(i18n)) {
  return [
    { label: t('common:weight.under5g'), min: null, max: 5 },
    { label: t('common:weight.5to10g'), min: 5, max: 10 },
    { label: t('common:weight.10to20g'), min: 10, max: 20 },
    { label: t('common:weight.20to30g'), min: 20, max: 30 },
    { label: t('common:weight.30to50g'), min: 30, max: 50 },
    { label: t('common:weight.over50g'), min: 50, max: null },
  ]
}

export function getSizeTypes(t = i18n.t.bind(i18n)) {
  return [
    { value: 'ring', label: t('common:sizeType.ring') },
    { value: 'necklace', label: t('common:sizeType.necklace') },
    { value: 'bangle', label: t('common:sizeType.bangle') },
    { value: 'bracelet', label: t('common:sizeType.bracelet') },
    { value: 'earring', label: t('common:sizeType.earring') },
    { value: 'pendant', label: t('common:sizeType.pendant') },
    { value: 'other', label: t('common:sizeType.other') },
  ]
}

export function getSizeTypeMeta(value, t = i18n.t.bind(i18n)) {
  return getSizeTypes(t).find((item) => item.value === value) || getSizeTypes(t).find((item) => item.value === 'other')
}

export function getSortOptions(t = i18n.t.bind(i18n)) {
  return [
    { value: 'featured', label: t('common:sort.featured') },
    { value: 'price_asc', label: t('common:sort.priceAsc') },
    { value: 'price_desc', label: t('common:sort.priceDesc') },
    { value: 'newest', label: t('common:sort.newest') },
  ]
}

export function getUaeOnlinePaymentModes(t = i18n.t.bind(i18n)) {
  return [
    { value: 'card', label: t('checkout:paymentModes.card') },
  ]
}

function titleCaseFallback(value) {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function getPaymentModeLabel(mode, t = i18n.t.bind(i18n)) {
  if (!mode) return '—'
  const key = `checkout:paymentModes.${mode}`
  const translated = t(key)
  if (translated !== key) return translated
  return titleCaseFallback(mode)
}

export function getPaymentMethodLabel(method, t = i18n.t.bind(i18n)) {
  if (!method) return '—'
  const key = `checkout:paymentMethods.${method}`
  const translated = t(key)
  if (translated !== key) return translated
  return titleCaseFallback(method)
}

export function getPaymentStatusLabel(status, t = i18n.t.bind(i18n)) {
  if (!status) return '—'
  const key = `checkout:paymentStatus.${status}`
  const translated = t(key)
  if (translated !== key) return translated
  return titleCaseFallback(status)
}

export function getOrderStatusLabel(status, t = i18n.t.bind(i18n)) {
  if (!status) return '—'
  const key = `orders:status.${status}`
  const translated = t(key)
  if (translated !== key) return translated
  return status
}

export function getEmirateLabel(emirate, t = i18n.t.bind(i18n)) {
  if (!emirate) return emirate
  const key = `common:emirate.${emirate}`
  const translated = t(key)
  if (translated !== key) return translated
  return emirate
}

export function getUaeEmirates(t = i18n.t.bind(i18n)) {
  const keys = [
    'Abu Dhabi', 'Ajman', 'Dubai', 'Fujairah',
    'Ras Al Khaimah', 'Sharjah', 'Umm Al Quwain',
  ]
  return keys.map((e) => ({ value: e, label: getEmirateLabel(e, t) }))
}

export function formatMetalTypeLabel(purity, metalType = 'gold', t = i18n.t.bind(i18n)) {
  if (!purity) return null
  const kt = purity.replace(/k$/i, 'Kt').replace(/^(\d+)Kt$/i, (_, n) => `${n}Kt`)
  const metal = metalType === 'silver' ? t('common:metal.silver') : t('common:metal.gold')
  return t('common:metalTypeLabel', { purity: kt, metal })
}

export function getAddressLabels(t = i18n.t.bind(i18n)) {
  return [
    { value: 'home', label: t('common:addressLabel.home') },
    { value: 'work', label: t('common:addressLabel.work') },
    { value: 'other', label: t('common:addressLabel.other') },
  ]
}

export function getSchemePaymentMethods(t = i18n.t.bind(i18n)) {
  return [
    { value: 'upi', label: t('scheme:method.upi'), description: t('scheme:method.upiDesc') },
    { value: 'card', label: t('scheme:method.card'), description: t('scheme:method.cardDesc') },
    { value: 'netbanking', label: t('scheme:method.netbanking'), description: t('scheme:method.netbankingDesc') },
  ]
}

export function getInstallmentStatusLabel(status, t = i18n.t.bind(i18n)) {
  const key = `scheme:installmentStatus.${status}`
  const translated = t(key)
  if (translated !== key) return translated
  return status
}

export function getEnrollmentStatusLabel(status, t = i18n.t.bind(i18n)) {
  const key = `scheme:enrollmentStatus.${status}`
  const translated = t(key)
  if (translated !== key) return translated
  return status
}

export function getCertificateBadgeLabel(authority, t = i18n.t.bind(i18n)) {
  const map = {
    'Purity Certificate': 'product:cert.bis',
    'BIS Hallmark': 'product:cert.generic',
    GIA: 'product:cert.gia',
    IGI: 'product:cert.igi',
    HRD: 'product:cert.hrd',
    'HRD Antwerp': 'product:cert.hrd',
    SGL: 'product:cert.sgl',
    GII: 'product:cert.gii',
    'Pearl Certificate': 'product:cert.pearl',
    'Coloured Gemstone': 'product:cert.gem',
  }
  const key = map[authority]
  if (key) return t(key)
  return authority || t('product:cert.generic')
}

export function getSchemeWalletCreditMessage(wallet, t = i18n.t.bind(i18n)) {
  if (!wallet || wallet.error) return null
  if (wallet.already_credited) {
    return t('common:schemeWalletAlreadyCredited')
  }
  const credited = Number(wallet.credited)
  if (credited > 0) {
    const balance =
      wallet.balance != null
        ? t('common:schemeWalletBalanceSuffix', { balance: formatAED(wallet.balance) })
        : ''
    return t('common:schemeWalletCredited', { amount: formatAED(credited), balance })
  }
  if (wallet.reason === 'not_fully_paid') {
    return t('common:schemeNotFullyPaid')
  }
  return null
}
