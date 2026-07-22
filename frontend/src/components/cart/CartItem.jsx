import { Link } from 'react-router-dom'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatINR } from '@/lib/pricing'
import { getStoneTypeLabel } from '@/lib/constants'
import { usePriceBreakup } from '@/hooks/usePriceBreakup'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'
import { VariantSizeSelector } from '@/components/product/ProductJewelleryDetails'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

function CartItemPrice({ variantId, fallbackPrice }) {
  const { data: breakup, isLoading } = usePriceBreakup(variantId)

  if (isLoading) return <Skeleton className="h-4 w-16" />

  const price = breakup?.total ?? fallbackPrice
  return (
    <span className="text-right">
      <span className="text-sm font-semibold text-gold">{formatINR(breakup?.display_total ?? price)}</span>
      <span className="mt-0.5 block text-[10px] text-muted">Incl. VAT</span>
    </span>
  )
}

export function CartItem({ item, onUpdateQty, onUpdateVariant, onRemove, isUpdating }) {
  const { t } = useTranslation(['common', 'errors'])
  const lang = useContentLang()
  const variant = item.product_variants
  const product = variant?.products
  const displayName = product ? pickField(product, 'name', lang) : t('common:productFallback')
  const variants = useMemo(() => product?.product_variants || [], [product?.product_variants])

  const handleQtyChange = async (delta) => {
    const newQty = item.qty + delta
    try {
      await onUpdateQty({ itemId: item.id, qty: newQty })
    } catch (err) {
      toast.error(err.message || t('errors:cart.updateQtyFailed'))
    }
  }

  const handleRemove = async () => {
    try {
      await onRemove(item.id)
      toast.success(t('common:removedFromBag'))
    } catch (err) {
      toast.error(err.message || t('errors:cart.removeItemFailed'))
    }
  }

  const handleVariantChange = useCallback(
    async (variantId) => {
      if (variantId === item.variant_id) return
      try {
        await onUpdateVariant({ itemId: item.id, variantId })
        toast.success(t('common:variantUpdated'))
      } catch (err) {
        toast.error(err.message || t('errors:cart.updateVariantFailed'))
      }
    },
    [item.id, item.variant_id, onUpdateVariant, t]
  )

  return (
    <div className="flex gap-3 rounded-xl border border-line bg-white p-3 sm:gap-4">
      <Link to={product ? `/product/${product.slug}` : '#'} className="shrink-0">
        <div className="h-16 w-16 overflow-hidden rounded-lg border border-line bg-ivory-3 sm:h-[72px] sm:w-[72px]">
          {product?.primary_image ? (
            <img
              src={product.primary_image}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted">
              {t('common:noImage')}
            </div>
          )}
        </div>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={product ? `/product/${product.slug}` : '#'}
              className="line-clamp-2 text-sm font-medium leading-snug text-navy hover:text-gold"
            >
              {displayName}
            </Link>
            <p className="mt-0.5 text-[11px] text-muted">
              {[
                product?.purity?.toUpperCase(),
                (variant?.effective_weight ?? variant?.weight_grams) &&
                  `${variant.effective_weight ?? variant.weight_grams}g`,
                getStoneTypeLabel(variant?.stone_type),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 min-h-0 shrink-0 text-muted hover:text-[#b3261e]"
            onClick={handleRemove}
            aria-label={t('common:removeItemAria')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {variants.length > 0 && (
          <div className="max-w-xs">
            <VariantSizeSelector
              key={item.variant_id}
              variants={variants}
              selectedId={item.variant_id}
              onSelect={handleVariantChange}
              compact
            />
          </div>
        )}

        {item.customization_request && (
          <p className="text-[11px] text-navy">
            {t('common:customPrefix')} {item.customization_request}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <CartItemPrice variantId={item.variant_id} fallbackPrice={item.price_snapshot} />
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 min-h-0 rounded-lg"
              disabled={isUpdating || item.qty <= 1}
              onClick={() => handleQtyChange(-1)}
              aria-label={t('common:decreaseQtyAria')}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="min-w-[1.5rem] text-center text-xs font-semibold tabular-nums">
              {item.qty}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 min-h-0 rounded-lg"
              disabled={isUpdating || item.qty >= (variant?.stock_qty ?? 99)}
              onClick={() => handleQtyChange(1)}
              aria-label={t('common:increaseQtyAria')}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
