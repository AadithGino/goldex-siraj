import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useProducts } from '@/hooks/useProducts'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'
import { ProductGrid } from '@/components/product/ProductGrid'

export function SimilarProducts({ product, limit = 4 }) {
  const { t } = useTranslation('product')
  const lang = useContentLang()
  const { data: products, isLoading } = useProducts({
    categoryId: product?.category_id,
  })

  const similar = useMemo(
    () => (products || []).filter((p) => p.id !== product?.id).slice(0, limit),
    [products, product?.id, limit]
  )

  if (!product?.category_id) return null

  return (
    <section className="scroll-mt-[calc(var(--storefront-header-height)+1rem)]">
      <h2 className="font-display text-xl text-navy sm:text-2xl">{t('similarTitle')}</h2>
      <p className="mt-1 text-sm text-muted">
        {t('similarSubtitle', {
          collection: product.categories
            ? pickField(product.categories, 'name', lang)
            : t('thisCollectionFallback'),
        })}
      </p>
      <div className="mt-6">
        <ProductGrid
          products={similar}
          isLoading={isLoading}
          emptyMessage={t('noSimilar')}
        />
      </div>
    </section>
  )
}
