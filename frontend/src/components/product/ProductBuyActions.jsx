import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { AddToBagButton } from '@/components/product/AddToBagButton'
import { ProductWhatsAppEnquiry } from '@/components/product/ProductWhatsAppEnquiry'

/**
 * Primary PDP / mobile purchase row: Add to Bag (~62%) + WhatsApp enquire (~38%).
 */
export function ProductBuyActions({
  variantId,
  customizationRequest,
  product,
  productName,
  variant,
  isOutOfStock = false,
  compact = false,
  className,
}) {
  const { t } = useTranslation('product')
  const height = compact ? 'h-12 min-h-12' : 'h-[52px] min-h-[52px]'
  const radius = 'rounded-xl'

  return (
    <div
      className={cn(
        'grid items-stretch gap-2.5',
        compact
          ? 'grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]'
          : 'grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] sm:gap-3',
        className,
      )}
    >
      <AddToBagButton
        variantId={isOutOfStock ? null : variantId}
        customizationRequest={customizationRequest}
        className={cn(
          height,
          radius,
          'w-full px-4 text-sm font-semibold !rounded-xl shadow-[0_6px_18px_rgba(20,33,61,.16)] sm:px-5 sm:text-base',
          compact && 'px-3 text-sm',
        )}
      >
        {isOutOfStock ? t('outOfStock') : undefined}
      </AddToBagButton>

      <ProductWhatsAppEnquiry
        product={product}
        productName={productName}
        variant={variant}
        variantId={variantId}
        layout="row"
        compact={compact}
        className={cn(height, radius, 'w-full')}
      />
    </div>
  )
}
