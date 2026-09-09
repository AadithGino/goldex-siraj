import { useTranslation } from 'react-i18next'
import { HeroBanner } from '@/components/home/HeroBanner'
import { BannerRow } from '@/components/home/BannerRow'
import { CategoryStrip } from '@/components/home/CategoryStrip'
import { BrandStrip } from '@/components/home/BrandStrip'
import { FeaturedGrid } from '@/components/home/FeaturedGrid'
import { OccasionGrid } from '@/components/home/OccasionGrid'
import { TrustBar } from '@/components/home/TrustBar'
import { SchemeSection } from '@/components/home/SchemeSection'
import { GoldRateTicker } from '@/components/home/GoldRateTicker'
import { CustomJewellerySection } from '@/components/home/CustomJewellerySection'
import { SellGoldSection } from '@/components/home/SellGoldSection'
import { useStoreSettings } from '@/hooks/useStoreSettings'
import { useProducts } from '@/hooks/useProducts'

export function HomePage() {
  const { t } = useTranslation(['home', 'common'])
  const { data: settings } = useStoreSettings()
  const { data: products, isLoading: productsLoading } = useProducts()

  return (
    <>
      {/* Live gold rate ticker */}
      <GoldRateTicker />

      {/* Full-bleed hero carousel (text baked into the image) */}
      <HeroBanner />

      {/* Slim full-width promo strip under the hero */}
      <BannerRow position="strip" full />

      {/* Shop by category */}
      <CategoryStrip />

      {/* Shop by brand */}
      <BrandStrip products={products || []} productsLoading={productsLoading} />

      {/* Shop by collection — 3 portrait banners */}
      <BannerRow position="collection" title={t('home:shopByCollection')} />

      {/* Offer cards — 2 up */}
      <BannerRow
        position="promo_top"
        title={t('home:specialOffers')}
        subtitle={t('home:specialOffersSubtitle')}
      />

      {/* Featured / best sellers */}
      <FeaturedGrid products={products || []} isLoadingProducts={productsLoading} />

      {/* Mid-page full-width campaign band */}
      <BannerRow position="deal" full />

      {/* Gifting — 2 up */}
      <BannerRow
        position="gifting"
        title={t('home:gifting')}
        subtitle={t('home:giftingSubtitle')}
      />

      {/* Shop by occasion */}
      <OccasionGrid products={products || []} isLoading={productsLoading} />

      {/* Full-width feature banner */}
      <BannerRow position="promo_bottom" />

      {/* Custom jewellery */}
      <CustomJewellerySection />
      <SellGoldSection />

      {/* Gold savings scheme */}
      {settings?.scheme_enabled && <SchemeSection />}

      {/* Trust signals */}
      <TrustBar />
    </>
  )
}
