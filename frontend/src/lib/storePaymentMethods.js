import { TABBY_LOGO_SRC } from '@/lib/tabbyBrand'

/** Logo assets and i18n keys for storefront payment badges (PDP, footer, etc.). */
export const PAYMENT_BADGES = {
  tabby: { key: 'tabby', src: TABBY_LOGO_SRC, labelKey: 'nav:footer.payments.tabby' },
  visa: { key: 'visa', src: '/payments/visa.png', labelKey: 'nav:footer.payments.visa' },
  mastercard: { key: 'mastercard', src: '/payments/mastercard.png', labelKey: 'nav:footer.payments.mastercard' },
  amex: { key: 'amex', src: '/payments/amex.png', labelKey: 'nav:footer.payments.amex' },
  cod: { key: 'cod', src: '/payments/cod.png', labelKey: 'nav:footer.payments.cod' },
}

/**
 * Payment methods the customer can use at checkout, derived from store settings.
 * Omits Tamara and other methods that are not wired in checkout.
 */
export function getEnabledStorePaymentMethods(settings) {
  if (!settings) return []
  const rows = []
  const online = settings.online_checkout_enabled === true

  if (online && settings.tabby_configured) {
    rows.push(PAYMENT_BADGES.tabby)
  }
  if (online && settings.paymob_configured) {
    rows.push(PAYMENT_BADGES.visa, PAYMENT_BADGES.mastercard, PAYMENT_BADGES.amex)
  }
  if (settings.cod_enabled === true) {
    rows.push(PAYMENT_BADGES.cod)
  }
  if (settings.bank_transfer_enabled !== false) {
    rows.push({ key: 'bank_transfer', labelKey: 'checkout:paymentMethods.manual' })
  }
  return rows
}
