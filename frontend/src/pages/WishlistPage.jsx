import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWishlist } from '@/hooks/useWishlist'
import { ProductGrid } from '@/components/product/ProductGrid'
import { Button } from '@/components/ui/button'

export function WishlistPage() {
  const { t } = useTranslation(['account', 'common'])
  const { items, isLoading } = useWishlist()

  const products = items
    .map((item) => item.products)
    .filter(Boolean)
    .map((product) => ({
      ...product,
      product_variants: product.product_variants || [],
    }))

  if (!isLoading && !products.length) {
    return (
      <div className="mx-auto max-w-[1320px] px-4 py-16 text-center sm:px-6">
        <Heart className="mx-auto h-10 w-10 text-gold" />
        <h1 className="mt-4 font-display text-3xl text-navy">{t('account:wishlistEmptyTitle')}</h1>
        <p className="mt-2 text-sm text-muted">{t('account:wishlistEmptyDesc')}</p>
        <Button asChild className="mt-6">
          <Link to="/search">{t('common:browseJewellery')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('account:wishlistEyebrow')}</p>
        <h1 className="font-display text-[clamp(28px,3.3vw,46px)] text-navy">{t('account:wishlistTitle')}</h1>
        <p className="mt-2 text-sm text-muted">
          {t('common:savedPiece', { count: products.length })}
        </p>
      </div>
      <ProductGrid
        products={products}
        isLoading={isLoading}
        emptyMessage={t('account:wishlistEmptyTitle')}
      />
    </div>
  )
}
