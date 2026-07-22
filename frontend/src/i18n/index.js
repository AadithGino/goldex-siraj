import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from '@/locales/en/common.json'
import enNav from '@/locales/en/nav.json'
import enAuth from '@/locales/en/auth.json'
import enCheckout from '@/locales/en/checkout.json'
import enAccount from '@/locales/en/account.json'
import enOrders from '@/locales/en/orders.json'
import enHome from '@/locales/en/home.json'
import enProduct from '@/locales/en/product.json'
import enScheme from '@/locales/en/scheme.json'
import enErrors from '@/locales/en/errors.json'

import arCommon from '@/locales/ar/common.json'
import arNav from '@/locales/ar/nav.json'
import arAuth from '@/locales/ar/auth.json'
import arCheckout from '@/locales/ar/checkout.json'
import arAccount from '@/locales/ar/account.json'
import arOrders from '@/locales/ar/orders.json'
import arHome from '@/locales/ar/home.json'
import arProduct from '@/locales/ar/product.json'
import arScheme from '@/locales/ar/scheme.json'
import arErrors from '@/locales/ar/errors.json'

export const LANG_STORAGE_KEY = 'goldex_lang'
export const SUPPORTED_LANGUAGES = ['en', 'ar']

function getStoredLanguage() {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY)
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored
  } catch {
    /* ignore */
  }
  return 'en'
}

export function applyDocumentLanguage(lng) {
  const lang = SUPPORTED_LANGUAGES.includes(lng) ? lng : 'en'
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
}

export function getIntlLocale(lng = i18n.language) {
  return lng === 'ar' ? 'ar-AE' : 'en-AE'
}

export function getContentLang(lng = i18n.language) {
  return lng?.startsWith('ar') ? 'ar' : 'en'
}

const resources = {
  en: {
    common: enCommon,
    nav: enNav,
    auth: enAuth,
    checkout: enCheckout,
    account: enAccount,
    orders: enOrders,
    home: enHome,
    product: enProduct,
    scheme: enScheme,
    errors: enErrors,
  },
  ar: {
    common: arCommon,
    nav: arNav,
    auth: arAuth,
    checkout: arCheckout,
    account: arAccount,
    orders: arOrders,
    home: arHome,
    product: arProduct,
    scheme: arScheme,
    errors: arErrors,
  },
}

const initialLang = getStoredLanguage()
applyDocumentLanguage(initialLang)

i18n.use(initReactI18next).init({
  resources,
  lng: initialLang,
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'nav', 'auth', 'checkout', 'account', 'orders', 'home', 'product', 'scheme', 'errors'],
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lng)
  } catch {
    /* ignore */
  }
  applyDocumentLanguage(lng)
})

export default i18n
