import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { pickBannerImages, pickBannerTitle } from '@/lib/contentLocale'
import { getContentLang } from '@/i18n'

/**
 * Renders the correct banner creative per breakpoint and active language.
 */
export function BannerPicture({ banner, className, imgClassName, loading = 'lazy' }) {
  const { i18n } = useTranslation()
  const lang = getContentLang(i18n.language)
  const { desktop, mobile } = pickBannerImages(banner, lang)
  const alt = pickBannerTitle(banner, lang)

  if (!mobile && !desktop) return null

  return (
    <picture className={cn('block h-full w-full', className)}>
      {desktop && <source media="(min-width: 640px)" srcSet={desktop} />}
      <img
        src={mobile || desktop}
        alt={alt}
        className={cn('h-full w-full object-cover', imgClassName)}
        loading={loading}
        decoding="async"
      />
    </picture>
  )
}
