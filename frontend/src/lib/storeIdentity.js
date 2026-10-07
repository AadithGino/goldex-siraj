/** Canonical Goldex company details (Billit / legal registration). */
export const STORE_BRAND = 'GOLDEX'

export const STORE_LEGAL_NAME_EN = 'THE GOLDEX JEWELLERY L.L.C'
export const STORE_LEGAL_NAME_AR = 'ذا جولديكس للمجوهرات ش.ذ.م.م'

export const STORE_EMAIL = 'goldexdxb@gmail.com'
export const STORE_COMPLIANCE_EMAIL = 'compliance@thegoldex.com'

/** WhatsApp support (footer / click-to-chat). Digits only for wa.me links. */
export const STORE_WHATSAPP_E164 = '971565084747'
export const STORE_WHATSAPP_DISPLAY = '+971565084747'

export function getStoreLegalName(lang) {
  return lang === 'ar' ? STORE_LEGAL_NAME_AR : STORE_LEGAL_NAME_EN
}

/** Digits-only WhatsApp for wa.me; settings override, else footer default. */
export function resolveStoreWhatsAppE164(settings) {
  const raw = settings?.whatsapp_number
  if (raw != null && String(raw).trim() !== '') {
    const digits = String(raw).replace(/\D/g, '')
    if (digits) return digits
  }
  return STORE_WHATSAPP_E164
}
