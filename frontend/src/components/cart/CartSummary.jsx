import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatINR } from '@/lib/pricing'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function CartSummary({
  subtotal,
  discount = 0,
  shipping = 0,
  taxAmount = 0,
  taxMode = 'exclusive',
  taxActive = true,
  total,
  isLoading,
  showCheckout = true,
  checkoutLabel,
  checkoutTo = '/checkout',
  className,
}) {
  const { t } = useTranslation(['checkout', 'common'])
  const navigate = useNavigate()
  const resolvedCheckoutLabel = checkoutLabel ?? t('checkout:proceedToCheckout')

  return (
    <div className={cn('rounded-lg border border-line bg-white', className)}>
      <div className="border-b border-line px-3 py-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-navy">{t('checkout:orderSummary')}</h3>
      </div>
      <div className="space-y-2 p-3 text-sm">
        {isLoading ? (
          <>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-6 w-full" />
          </>
        ) : (
          <>
            <div className="flex justify-between text-muted">
              <span>{t('checkout:subtotal')}</span>
              <span className="text-navy">{formatINR(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-muted">
                <span>{t('checkout:discount')}</span>
                <span className="text-[#2f7d4f]">−{formatINR(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted">
              <span>{t('checkout:shipping')}</span>
              <span className="text-navy">{shipping > 0 ? formatINR(shipping) : t('common:free')}</span>
            </div>
            {(taxActive || taxAmount > 0 || taxMode === 'inclusive') && (
              <div className="flex justify-between text-muted">
                <span>{taxMode === 'inclusive' ? t('checkout:vatIncluded') : t('checkout:vat')}</span>
                <span className="text-navy">{formatINR(taxAmount || 0)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-2 font-semibold text-navy">
              <span>{t('checkout:estimatedTotal')}</span>
              <span className="text-gold">{formatINR(total)}</span>
            </div>
            <p className="text-[11px] text-muted">{t('checkout:finalPriceNote')}</p>
          </>
        )}

        {showCheckout && (
          <Button
            type="button"
            size="sm"
            className="mt-2 w-full"
            onClick={() => navigate(checkoutTo)}
          >
            {resolvedCheckoutLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
