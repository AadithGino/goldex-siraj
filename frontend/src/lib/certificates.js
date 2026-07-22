import { getCertificateBadgeLabel } from '@/lib/i18nLabels'
import i18n from '@/i18n'
export const CERTIFICATE_AUTHORITIES = [
  {
    value: 'Purity Certificate',
    label: 'Purity Certificate',
    badge: 'Purity Certificate',
    badgeVariant: 'gold',
    appliesTo: 'Gold & silver purity documentation.',
    whyUpload: 'Customers verify purity (22K/18K), net weight, and certificate details.',
  },
  {
    value: 'GIA',
    label: 'GIA',
    badge: 'GIA Certified',
    badgeVariant: 'navy',
    appliesTo: 'Diamond grading — cut, colour, clarity, carat (international standard).',
    whyUpload: 'Buyers download the grading report to verify the exact diamond specs before purchase.',
  },
  {
    value: 'IGI',
    label: 'IGI',
    badge: 'IGI Certified',
    badgeVariant: 'navy',
    appliesTo: 'Diamonds and gemstones — common for solitaire grading.',
    whyUpload: 'Provides independent proof of stone quality for high-value diamond pieces.',
  },
  {
    value: 'HRD',
    label: 'HRD Antwerp',
    badge: 'HRD Certified',
    badgeVariant: 'outline',
    appliesTo: 'Diamond certification (European standard).',
    whyUpload: 'Required for customers comparing international diamond grades.',
  },
  {
    value: 'SGL',
    label: 'SGL',
    badge: 'SGL Certified',
    badgeVariant: 'outline',
    appliesTo: 'Solitaire & gemstone lab certification.',
    whyUpload: 'Supports trust for studded jewellery with certified centre stones.',
  },
  {
    value: 'GII',
    label: 'GII',
    badge: 'GII Certified',
    badgeVariant: 'outline',
    appliesTo: 'Gemological certification for coloured stones and diamonds.',
    whyUpload: 'Documents authenticity for ruby, emerald, sapphire, and diamond pieces.',
  },
  {
    value: 'Pearl Certificate',
    label: 'Pearl certificate',
    badge: 'Certified Pearl',
    badgeVariant: 'gold',
    appliesTo: 'Pearl strand, earrings, and pendant quality grading.',
    whyUpload: 'Shows lustre, nacre quality, and origin for pearl jewellery.',
  },
  {
    value: 'Coloured Gemstone',
    label: 'Coloured gemstone report',
    badge: 'Gem Certified',
    badgeVariant: 'outline',
    appliesTo: 'Ruby, emerald, sapphire, and other precious stones.',
    whyUpload: 'Confirms natural vs treated stones and documents carat weight.',
  },
  {
    value: 'Other',
    label: 'Other authority',
    badge: 'Certified',
    badgeVariant: 'muted',
    appliesTo: 'Store-issued or third-party authenticity documents.',
    whyUpload: 'Any PDF or image proof you want the customer to view or download.',
  },
]

export function getAuthorityMeta(authority) {
  if (!authority) return null
  const known = CERTIFICATE_AUTHORITIES.find(
    (a) => a.value.toLowerCase() === authority.toLowerCase()
  )
  if (known) return known
  return {
    value: authority,
    label: authority,
    badge: authority,
    badgeVariant: 'gold',
    appliesTo: 'Authenticity documentation for this piece.',
    whyUpload: 'Upload the certificate so customers can verify before buying.',
  }
}

/** Certificates that apply to a variant (product-wide + variant-specific) */
export function certificatesForVariant(certificates = [], variantId) {
  if (!certificates?.length) return []
  return certificates.filter((c) => !c.variant_id || c.variant_id === variantId)
}

/** One badge per authority for display */
export function getCertificateBadgeList(certificates = [], variantId) {
  const scoped = certificatesForVariant(certificates, variantId)
  const seen = new Set()
  return scoped.filter((c) => {
    const key = (c.authority || '').toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function getBadgeLabel(cert, t = i18n.t.bind(i18n)) {
  return getCertificateBadgeLabel(cert.authority, t)
}

export function getBadgeVariant(cert) {
  return getAuthorityMeta(cert.authority)?.badgeVariant || 'gold'
}

/** Metadata fields shown in admin form per authority */
export const CERT_METADATA_FIELDS = {
  'Purity Certificate': [
    { key: 'purity', label: 'Certified purity', placeholder: '22K916' },
    { key: 'net_weight', label: 'Net weight (g)', placeholder: '4.520' },
    { key: 'gross_weight', label: 'Gross weight (g)', placeholder: '4.850' },
  ],
  'BIS Hallmark': [
    { key: 'purity', label: 'Hallmarked purity', placeholder: '22K916' },
    { key: 'net_weight', label: 'Net weight (g)', placeholder: '4.520' },
    { key: 'gross_weight', label: 'Gross weight (g)', placeholder: '4.850' },
  ],
  GIA: [
    { key: 'carat', label: 'Carat weight', placeholder: '0.50' },
    { key: 'color', label: 'Colour grade', placeholder: 'F' },
    { key: 'clarity', label: 'Clarity', placeholder: 'VS1' },
    { key: 'cut', label: 'Cut', placeholder: 'Excellent' },
  ],
  IGI: [
    { key: 'carat', label: 'Carat weight', placeholder: '0.75' },
    { key: 'color', label: 'Colour grade', placeholder: 'G' },
    { key: 'clarity', label: 'Clarity', placeholder: 'VS2' },
  ],
  HRD: [
    { key: 'carat', label: 'Carat weight', placeholder: '1.00' },
    { key: 'color', label: 'Colour', placeholder: 'G' },
    { key: 'clarity', label: 'Clarity', placeholder: 'VVS2' },
  ],
  SGL: [
    { key: 'stone_type', label: 'Stone type', placeholder: 'Diamond' },
    { key: 'carat', label: 'Carat / weight', placeholder: '0.30 ct' },
  ],
  GII: [
    { key: 'stone_type', label: 'Stone type', placeholder: 'Ruby' },
    { key: 'carat', label: 'Weight', placeholder: '1.2 ct' },
  ],
  'Pearl Certificate': [
    { key: 'pearl_type', label: 'Pearl type', placeholder: 'Freshwater / South Sea' },
    { key: 'grade', label: 'Grade', placeholder: 'AAA' },
  ],
  'Coloured Gemstone': [
    { key: 'stone_type', label: 'Gemstone', placeholder: 'Emerald' },
    { key: 'carat', label: 'Weight', placeholder: '0.8 ct' },
    { key: 'origin', label: 'Origin', placeholder: 'Colombia' },
  ],
}

export function getMetadataFieldsForAuthority(authority) {
  const meta = getAuthorityMeta(authority)
  if (!meta) return []
  return CERT_METADATA_FIELDS[meta.value] || []
}
