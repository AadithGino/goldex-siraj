import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { BannerPicture } from '@/components/banners/BannerPicture'
import { cn } from '@/lib/utils'
import { useBanners } from '@/hooks/useBanners'
import { getBannerSpec } from '@/lib/bannerSpecs'

function PromoBanner({ banner, variant = 'feature' }) {
  const { t } = useTranslation('common')
  const isFeature = variant === 'feature'
  const position = isFeature ? 'promo_bottom' : 'promo_top'
  const spec = getBannerSpec(position)

  return (
    <Link
      to={banner.cta_link || '/search'}
      className={cn(
        'group relative block overflow-hidden border border-line bg-ivory-3 transition-[border-color,box-shadow,transform] duration-500 hover:-translate-y-0.5 hover:border-gold/35 hover:shadow-[0_12px_32px_rgba(20,33,61,0.1)]',
        spec.aspectClass,
        isFeature ? 'rounded-xl sm:rounded-2xl' : 'rounded-xl'
      )}
    >
      {banner.image_url || banner.mobile_image_url ? (
        <BannerPicture
          banner={banner}
          imgClassName="transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-navy to-navy-2 p-4 text-sm text-gold-3/80">
          {t('noBannerImage')}
        </div>
      )}
    </Link>
  )
}

function PromoSection({ title, subtitle, banners, variant, loading }) {
  const loadingSpec = getBannerSpec(variant === 'feature' ? 'promo_bottom' : 'promo_top')

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div
          className={cn(
            'grid gap-3',
            variant === 'feature' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
          )}
        >
          <Skeleton className={`${loadingSpec.aspectClass} rounded-xl`} />
          {variant !== 'feature' && (
            <Skeleton className={`${getBannerSpec('promo_top').aspectClass} rounded-xl max-sm:hidden`} />
          )}
        </div>
      </div>
    )
  }

  if (!banners?.length) return null

  return (
    <div>
      {(title || subtitle) && (
        <div className="mb-4 flex items-end justify-between gap-3 sm:mb-5">
          <div>
            {title && (
              <h2 className="font-display text-xl text-navy sm:text-2xl">{title}</h2>
            )}
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
        </div>
      )}

      {variant === 'feature' ? (
        <div
          className={cn(
            'grid gap-3 sm:gap-4',
            banners.length === 1 && 'grid-cols-1',
            banners.length === 2 && 'grid-cols-1 lg:grid-cols-2',
            banners.length >= 3 && 'grid-cols-1 lg:grid-cols-2'
          )}
        >
          {banners.map((banner, i) => (
            <div
              key={banner.id}
              className={banners.length >= 3 && i === 0 ? 'lg:col-span-2' : undefined}
            >
              <PromoBanner banner={banner} variant="feature" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {banners.map((banner) => (
            <div key={banner.id} className="w-[min(85vw,320px)] shrink-0 sm:w-auto">
              <PromoBanner banner={banner} variant="compact" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function PromoCards() {
  const { t } = useTranslation('home')
  const { data: topBanners, isLoading: topLoading } = useBanners('promo_top')
  const { data: bottomBanners, isLoading: bottomLoading } = useBanners('promo_bottom')

  const hasTop = topLoading || topBanners?.length
  const hasBottom = bottomLoading || bottomBanners?.length

  if (!hasTop && !hasBottom) return null

  return (
    <section className="py-8 sm:py-10">
      <div className="mx-auto max-w-[1320px] space-y-10 px-4 sm:space-y-12 sm:px-6">
        {(topLoading || topBanners?.length > 0) && (
          <PromoSection
            title={t('specialOffers')}
            subtitle={t('specialOffersSubtitle')}
            banners={topBanners}
            variant="compact"
            loading={topLoading}
          />
        )}

        {(bottomLoading || bottomBanners?.length > 0) && (
          <PromoSection
            title={t('discoverMore')}
            subtitle={t('discoverMoreSubtitle')}
            banners={bottomBanners}
            variant="feature"
            loading={bottomLoading}
          />
        )}
      </div>
    </section>
  )
}
