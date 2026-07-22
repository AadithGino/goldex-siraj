import { useTranslation } from 'react-i18next'
import { AddToBagButton } from '@/components/product/AddToBagButton'
import { usePriceBreakup } from '@/hooks/usePriceBreakup'
import { formatINR } from '@/lib/pricing'

export function MobileProductActionBar({ variantId, customizationRequest, isOutOfStock = false }) {
  const { t } = useTranslation(['product', 'checkout'])
  const { data: breakup } = usePriceBreakup(variantId)

  const price = breakup?.display_total ?? breakup?.total

  return (
    <div
      className="fixed inset-x-0 z-50 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"
      style={{ bottom: 'calc(var(--mobile-nav-height) + env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
        <div className="min-w-0 flex-1">
          {price != null ? (
            <p className="truncate font-display text-xl leading-none text-gold">{formatINR(price)}</p>
          ) : (
            <p className="truncate text-sm text-muted">{t('product:priceUnavailable')}</p>
          )}
          <p className="mt-1 text-[11px] text-muted">
            {t('checkout:vatIncluded')}
          </p>
        </div>

        <AddToBagButton
          variantId={isOutOfStock ? null : variantId}
          customizationRequest={customizationRequest}
          className="min-h-[48px] rounded-xl px-5 text-sm font-semibold"
        >
          {isOutOfStock ? t('product:outOfStock') : t('product:addToBag')}
        </AddToBagButton>
      </div>
    </div>
  )
}
