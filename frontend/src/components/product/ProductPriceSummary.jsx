import { useTranslation } from 'react-i18next'
import { formatINR } from '@/lib/pricing'
import { usePriceBreakup } from '@/hooks/usePriceBreakup'
import { Skeleton } from '@/components/ui/skeleton'

export function ProductPriceSummary({ variantId }) {
  const { t } = useTranslation('product')
  const { data: breakup, isLoading, error } = usePriceBreakup(variantId)
  const hasFixedPrice = breakup?.fixed_price != null || breakup?.price_override != null

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-10 w-40" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
    )
  }

  if (error || !breakup) {
    return <p className="text-sm text-muted">{t('priceUnavailable')}</p>
  }

  return (
    <div>
      <p className="font-display text-[clamp(28px,4vw,36px)] leading-none text-gold">
        {formatINR(breakup.display_total ?? breakup.total)}
      </p>
      {hasFixedPrice ? (
        <p className="mt-2 text-xs text-muted">
          {t('fixedPriceInclusive')} · {t('includesVatNote')}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted">
          {t('liveGoldRateLine', {
            purity: breakup.purity?.toUpperCase(),
            rate: formatINR(breakup.gold_rate),
          })}
          {Number(breakup.stone_charge) > 0 && ` · ${t('includesStoneCharge')}`}
          {` · ${t('includesVatNote')}`}
        </p>
      )}
    </div>
  )
}
