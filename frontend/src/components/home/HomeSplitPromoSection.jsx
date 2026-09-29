import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { BannerPicture } from '@/components/banners/BannerPicture'
import { useBanners } from '@/hooks/useBanners'
import { pickBannerImages } from '@/lib/contentLocale'
import { getContentLang } from '@/i18n'
import { useTranslation } from 'react-i18next'

/**
 * Half-width image + half-width copy — home custom / sell jewellery blocks.
 * Image comes from admin banners (`position` = custom_jewellery | sell_jewellery).
 */
export function HomeSplitPromoSection({
  bannerPosition,
  imageSide = 'right',
  tone = 'light',
  children,
}) {
  const { i18n } = useTranslation()
  const lang = getContentLang(i18n.language)
  const { data: banners = [], isLoading } = useBanners(bannerPosition, { limit: 1 })
  const banner = banners[0]
  const images = banner ? pickBannerImages(banner, lang) : null
  const hasImage = Boolean(images?.desktop || images?.mobile)

  const imageFirst = imageSide === 'left'

  return (
    <section className="py-8 sm:py-10">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <div
          className={cn(
            'grid overflow-hidden rounded-[28px] border shadow-[0_16px_40px_rgba(12,23,48,0.08)] lg:min-h-[440px] lg:grid-cols-2',
            tone === 'dark'
              ? 'border-gold/25 bg-navy text-gold-3 shadow-[0_16px_40px_rgba(12,23,48,0.18)]'
              : 'border-gold/25 bg-ivory-2 text-navy',
          )}
        >
          <div
            className={cn(
              'relative min-h-[240px] sm:min-h-[320px] lg:min-h-full',
              imageFirst ? 'lg:order-1' : 'lg:order-2',
            )}
          >
            {isLoading ? (
              <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
            ) : hasImage ? (
              <BannerPicture
                banner={banner}
                className="absolute inset-0"
                imgClassName="object-cover"
                loading="eager"
              />
            ) : (
              <div
                className={cn(
                  'absolute inset-0',
                  tone === 'dark'
                    ? 'bg-gradient-to-br from-navy via-[#0f2844] to-navy'
                    : 'bg-gradient-to-br from-ivory-2 via-gold/5 to-ivory-3',
                )}
                aria-hidden
              >
                <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,rgb(184,144,47)_1px,transparent_0)] [background-size:24px_24px]" />
              </div>
            )}
            <div
              className={cn(
                'pointer-events-none absolute inset-0 lg:hidden',
                tone === 'dark'
                  ? 'bg-gradient-to-t from-navy/90 via-navy/20 to-transparent'
                  : 'bg-gradient-to-t from-ivory-2/90 via-transparent to-transparent',
              )}
            />
          </div>

          <div
            className={cn(
              'relative flex flex-col justify-center p-6 sm:p-8 lg:p-10 xl:p-12',
              imageFirst ? 'lg:order-2' : 'lg:order-1',
            )}
          >
            {tone === 'light' && (
              <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />
            )}
            {tone === 'dark' && (
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/20 blur-3xl" />
            )}
            <div className="relative">{children}</div>
          </div>
        </div>
      </div>
    </section>
  )
}
