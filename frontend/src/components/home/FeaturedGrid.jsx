import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductGrid } from '@/components/product/ProductGrid'
import { useProducts } from '@/hooks/useProducts'

export function FeaturedGrid({ products: sourceProducts = null, isLoadingProducts = false }) {
  const { t } = useTranslation(['home', 'common'])
  const usingSharedProducts = Array.isArray(sourceProducts)
  const featuredQuery = useProducts({ featured: true, enabled: !usingSharedProducts })
  const products = usingSharedProducts
    ? sourceProducts.filter((product) => Boolean(product?.is_featured))
    : featuredQuery.data
  const isLoading = usingSharedProducts ? isLoadingProducts : featuredQuery.isLoading
  const error = featuredQuery.error

  return (
    <section className="py-10 sm:py-12">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('home:featuredEyebrow')}</p>
            <h2 className="font-display text-[clamp(28px,3.3vw,46px)] text-navy">
              {t('home:featuredTitle')}
            </h2>
          </div>
          <p className="max-w-sm text-sm text-muted">
            {t('home:featuredSubtitle')}
          </p>
        </div>

        <ProductGrid products={products} isLoading={isLoading} error={error} />

        <div className="mt-8 text-center">
          <Button variant="outline" asChild>
            <Link to="/search">
              {t('common:viewAllTitle')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
