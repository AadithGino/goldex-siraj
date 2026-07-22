import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useBrands } from '@/hooks/useBrands'
import { useProducts } from '@/hooks/useProducts'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'
import { brandLogoUrl } from '@/lib/catalogPayloads'

export function BrandStrip() {
  const { t } = useTranslation(['home', 'common'])
  const lang = useContentLang()
  const { data: brands, isLoading: brandsLoading } = useBrands()
  const { data: products, isLoading: productsLoading } = useProducts()

  const activeBrands = (brands || []).filter((brand) => brand.is_active !== false).slice(0, 6)
  const productCountByBrand = new Map()
  ;(products || []).forEach((product) => {
    if (!product.brand_id) return
    productCountByBrand.set(product.brand_id, (productCountByBrand.get(product.brand_id) || 0) + 1)
  })

  if (brandsLoading) {
    return (
      <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6">
        <Skeleton className="mb-6 h-9 w-56" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-4/3 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!activeBrands.length) return null

  return (
    <section className="py-10 sm:py-12">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('home:brandsEyebrow')}</p>
            <h2 className="font-display text-[clamp(24px,2.8vw,38px)] text-navy">{t('home:shopByBrand')}</h2>
          </div>
          <Link
            to="/search"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-navy hover:text-gold"
          >
            {t('common:viewAll')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {activeBrands.map((brand) => {
            const brandName = pickField(brand, 'name', lang)
            const logo = brandLogoUrl(brand)
            const banner = brand.banner_mobile_url || brand.banner_tablet_url || brand.banner_desktop_url
            const productCount = productCountByBrand.get(brand.id) || 0
            return (
              <Link
                key={brand.id}
                to={`/brand/${brand.slug}`}
                className="group overflow-hidden rounded-2xl border border-line bg-ivory-2 transition-all hover:border-gold/40 hover:shadow-[0_10px_24px_rgba(20,33,61,.12)]"
              >
                {banner ? (
                  <img
                    src={banner}
                    alt={brandName}
                    className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-ivory-3 font-display text-2xl text-gold">
                    {brandName.charAt(0)}
                  </div>
                )}
                <div className="space-y-1 p-3">
                  <div className="flex h-9 items-center">
                    {logo ? (
                      <img src={logo} alt={brandName} className="max-h-9 max-w-full object-contain" />
                    ) : (
                      <p className="line-clamp-1 text-sm font-semibold text-navy">{brandName}</p>
                    )}
                  </div>
                  <p className="line-clamp-1 text-xs text-muted">{brandName}</p>
                  <p className="text-xs text-muted">
                    {productsLoading ? t('common:loading') : t('common:pieceCount', { count: productCount })}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
