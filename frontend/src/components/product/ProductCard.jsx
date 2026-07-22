import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShoppingCart } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatINR } from '@/lib/pricing'
import { usePriceBreakup } from '@/hooks/usePriceBreakup'
import { getDefaultVariant, getProductCardImages } from '@/hooks/useProducts'
import { WishlistButton } from '@/components/product/WishlistButton'
import { AddToBagButton } from '@/components/product/AddToBagButton'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'

const easePremium = 'cubic-bezier(0.22, 1, 0.36, 1)'

const imageClass =
  'absolute inset-0 h-full w-full object-contain p-3 sm:p-4 lg:p-3 transition-[opacity,transform] duration-700 ease-[var(--ease-premium)] will-change-[opacity,transform] motion-reduce:transition-none'

function ProductCardPrice({ variantId }) {
  const { t } = useTranslation('product')
  const { data: breakup, isLoading } = usePriceBreakup(variantId)
  if (isLoading) return <Skeleton className="h-4 w-24 lg:h-5 lg:w-28" />
  if (!breakup) return <span className="text-xs text-muted lg:text-sm">{t('priceUnavailable')}</span>
  return (
    <span className="text-sm font-bold leading-tight text-ink transition-colors duration-500 group-hover:text-navy lg:text-[15px]">
      {formatINR(breakup.display_total ?? breakup.total)}
    </span>
  )
}

/** Catalogue card — Jos Alukkas–style tile with premium hover motion. */
export function ProductCard({ product }) {
  const { t } = useTranslation(['product', 'common'])
  const lang = useContentLang()
  const displayName = pickField(product, 'name', lang)
  const variant = getDefaultVariant(product)
  const { primary, hover } = getProductCardImages(product)
  const hasHoverImage = Boolean(primary && hover)

  return (
    <article
      className="product-card-premium group flex flex-col border border-line bg-white transition-[border-color,box-shadow,transform] duration-500 ease-[var(--ease-premium)] hover:-translate-y-1 hover:border-gold/25 hover:shadow-[0_14px_36px_rgba(20,33,61,0.09)] motion-reduce:transition-none motion-reduce:hover:transform-none"
      style={{ '--ease-premium': easePremium }}
    >
      <div className="relative overflow-hidden bg-white">
        <Link to={`/product/${product.slug}`} className="block">
          <div className="relative aspect-square overflow-hidden bg-white">
            {primary ? (
              <div className="absolute inset-0 transition-transform duration-700 ease-[var(--ease-premium)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                <img
                  src={primary}
                  alt={displayName}
                  className={cn(
                    imageClass,
                    hasHoverImage && 'opacity-100 group-hover:opacity-0'
                  )}
                />
                {hover && (
                  <img
                    src={hover}
                    alt=""
                    aria-hidden
                    className={cn(imageClass, 'opacity-0 group-hover:opacity-100')}
                  />
                )}
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted lg:text-sm">
                {t('common:noImage')}
              </div>
            )}
          </div>
        </Link>
        <WishlistButton
          productId={product.id}
          className="absolute right-2 top-2 z-10 h-7 w-7 rounded-none bg-transparent opacity-80 transition-all duration-500 ease-[var(--ease-premium)] hover:scale-110 hover:bg-transparent hover:opacity-100 group-hover:opacity-100 motion-reduce:transition-none sm:right-2.5 sm:top-2.5 sm:h-8 sm:w-8"
          iconClassName="h-4 w-4 stroke-[1.5] transition-transform duration-500 group-hover:scale-105 sm:h-[18px] sm:w-[18px]"
        />
      </div>

      <div className="flex flex-1 flex-col border-t border-line bg-ivory-3 px-2.5 pb-2.5 pt-2 transition-colors duration-500 ease-[var(--ease-premium)] group-hover:bg-[#f2f3f6] sm:px-3 sm:pb-3 sm:pt-2.5">
        <Link to={`/product/${product.slug}`} className="min-w-0">
          <h3 className="truncate text-xs font-normal leading-snug text-ink transition-colors duration-500 ease-[var(--ease-premium)] group-hover:text-navy sm:text-sm">
            {displayName}
          </h3>
        </Link>
        <div className="mt-1 flex items-center justify-between gap-1.5 sm:mt-1.5 sm:gap-2">
          <div className="min-w-0 flex-1">
            {variant ? (
              <ProductCardPrice variantId={variant.id} />
            ) : (
              <span className="text-xs text-muted lg:text-sm">{t('product:outOfStock')}</span>
            )}
          </div>
          {variant && (
            <AddToBagButton
              variantId={variant.id}
              variant="ghost"
              size="icon"
              className="product-card-cart !min-h-0 h-8 w-8 shrink-0 rounded-none border-0 bg-[#e4e6ea] p-0 text-muted shadow-none transition-all duration-500 ease-[var(--ease-premium)] hover:scale-105 hover:bg-navy hover:text-white hover:shadow-[0_6px_16px_rgba(20,33,61,0.22)] active:scale-95 group-hover:bg-navy group-hover:text-white group-hover:shadow-[0_6px_16px_rgba(20,33,61,0.18)] motion-reduce:transition-none sm:h-9 sm:w-9"
            >
              <ShoppingCart className="h-4 w-4 stroke-[1.5] transition-transform duration-500 ease-[var(--ease-premium)] group-hover:-translate-y-px motion-reduce:transition-none sm:h-[18px] sm:w-[18px]" />
            </AddToBagButton>
          )}
        </div>
      </div>
    </article>
  )
}
