/** Canonical Goldex company details (Billit / legal registration). */
export const STORE_BRAND = 'GOLDEX'

export const STORE_LEGAL_NAME_EN = 'THE GOLDEX JEWELLERY L.L.C'
export const STORE_LEGAL_NAME_AR = 'ذا جولديكس للمجوهرات ش.ذ.م.م'

export const STORE_EMAIL = 'goldexdxb@gmail.com'
export const STORE_COMPLIANCE_EMAIL = 'compliance@thegoldex.com'

export function getStoreLegalName(lang) {
  return lang === 'ar' ? STORE_LEGAL_NAME_AR : STORE_LEGAL_NAME_EN
}
