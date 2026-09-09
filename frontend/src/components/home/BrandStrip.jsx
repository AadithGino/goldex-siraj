import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useBrands } from '@/hooks/useBrands'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'
import { brandLogoUrl } from '@/lib/catalogPayloads'

export function BrandStrip({ products = [], productsLoading = false }) {
  const { t } = useTranslation(['home', 'common'])
  const lang = useContentLang()
  const { data: brands, isLoading: brandsLoading } = useBrands()

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
            <Skeleton key={i} className="h-36 rounded-2xl" />
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
            const mark = logo || brand.banner_mobile_url || brand.banner_tablet_url || brand.banner_desktop_url
            const productCount = productCountByBrand.get(brand.id) || 0
            return (
              <Link
                key={brand.id}
                to={`/brand/${brand.slug}`}
                className="group flex flex-col items-center rounded-2xl border border-line bg-ivory-2 px-4 py-5 text-center transition-all hover:border-gold/40 hover:shadow-[0_10px_24px_rgba(20,33,61,.12)]"
              >
                <div className="flex h-14 w-full items-center justify-center sm:h-16">
                  {mark ? (
                    <img
                      src={mark}
                      alt=""
                      className="max-h-12 max-w-[7.5rem] object-contain sm:max-h-14 sm:max-w-[8.5rem]"
                    />
                  ) : (
                    <span className="font-display text-2xl text-gold">{brandName.charAt(0)}</span>
                  )}
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-semibold text-navy">{brandName}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {productsLoading ? t('common:loading') : t('common:pieceCount', { count: productCount })}
                </p>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
