import { useTranslation } from 'react-i18next'
import { getContentLang } from '@/i18n'

/** Returns current content language and re-renders when storefront language changes. */
export function useContentLang() {
  const { i18n } = useTranslation()
  return getContentLang(i18n.language)
}
