import { useTranslation } from 'react-i18next'
import { formatINR } from '@/lib/pricing'
import { getVatRowLabel } from '@/lib/vatLabels'
import { usePriceBreakup } from '@/hooks/usePriceBreakup'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function BreakupRow({ label, detail, value, highlight = false }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="min-w-0">
        <span className={highlight ? 'font-medium text-navy' : 'text-muted'}>{label}</span>
        {detail && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{detail}</span>}
      </span>
      <span className={`shrink-0 ${highlight ? 'font-display text-lg text-gold' : 'text-ink'}`}>
        {value}
      </span>
    </div>
  )
}

function BreakupContent({ breakup, t }) {
  const hasFixedPrice = breakup?.fixed_price != null || breakup?.price_override != null
  const stoneDetail = (stone) =>
    [
      stone.count > 1
        ? t('product:stoneCount', { count: stone.count })
        : stone.count === 1
          ? t('product:stoneCount', { count: 1 })
          : null,
      stone.shape,
      stone.size_mm != null ? `${Number(stone.size_mm)} mm` : null,
      stone.setting_type,
    ]
      .filter(Boolean)
      .join(' · ')

  if (hasFixedPrice) {
    return (
      <>
        <p className="font-display text-2xl text-gold">{formatINR(breakup.display_total ?? breakup.total)}</p>
        <p className="mt-2 text-xs text-muted">{t('product:fixedPriceVariant')}</p>
      </>
    )
  }

  const stoneLines = Array.isArray(breakup.stones) ? breakup.stones : []
  const wastage = Number(breakup.wastage_percent) || 0
  const netWeight = Number(breakup.net_weight) || 0
  const effectiveWeight = Number(breakup.effective_weight) || netWeight

  const goldDetail = [
    netWeight > 0 && t('product:breakupDetail.netWeight', { weight: netWeight }),
    wastage > 0 && t('product:breakupDetail.wastage', { wastage }),
    effectiveWeight > 0 &&
      t('product:breakupDetail.effectiveCalc', {
        weight: effectiveWeight,
        rate: formatINR(breakup.gold_rate),
      }),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="space-y-4">
      <BreakupRow
        label={t('product:breakupRow.goldValue')}
        detail={
          goldDetail ||
          t('product:liveGoldRateLine', {
            purity: breakup.purity?.toUpperCase(),
            rate: formatINR(breakup.gold_rate),
          })
        }
        value={formatINR(breakup.gold_value)}
      />

      <BreakupRow
        label={t('product:breakupRow.wastageCharge')}
        detail={t('product:breakupDetail.wastage', { wastage: Number(breakup.wastage_percent) || 0 })}
        value={formatINR(breakup.wastage_amount || 0)}
      />

      {stoneLines.length > 0 ? (
        stoneLines.map((stone, i) => (
          <BreakupRow
            key={stone.id || `${stone.label}-${i}`}
            label={stone.label || t('product:breakupRow.stone')}
            detail={stoneDetail(stone) || undefined}
            value={formatINR(stone.charge)}
          />
        ))
      ) : Number(breakup.stone_charge) > 0 ? (
        <BreakupRow
          label={t('product:breakupRow.stoneCharge')}
          value={formatINR(breakup.stone_charge)}
        />
      ) : null}

      <BreakupRow
        label={t('product:breakupRow.makingCharges')}
        value={formatINR(breakup.making_charge)}
      />

      <div className="border-t border-gold/15 pt-3">
        <BreakupRow
          label={t('product:breakupRow.subtotalBeforeVat')}
          value={formatINR(breakup.subtotal_before_vat ?? breakup.subtotal)}
        />
      </div>

      <BreakupRow
        label={getVatRowLabel(breakup, t)}
        value={formatINR(breakup.vat_amount || 0)}
      />

      <div className="border-t border-gold/20 pt-3">
        <BreakupRow
          label={t('product:breakupRow.itemPrice')}
          value={formatINR(breakup.display_total ?? breakup.total)}
          highlight
        />
      </div>
      <p className="text-xs text-muted">{t('product:shippingDiscountCheckoutNote')}</p>
    </div>
  )
}

export function PriceBreakup({ variantId, embedded = false }) {
  const { t } = useTranslation('product')
  const { data: breakup, isLoading, error } = usePriceBreakup(variantId)
  const hasFixedPrice = breakup?.fixed_price != null || breakup?.price_override != null

  if (isLoading) {
    if (embedded) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      )
    }
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error || !breakup) {
    const msg = <p className="text-sm text-muted">{t('priceBreakupLoadFailed')}</p>
    if (embedded) return msg
    return <Card><CardContent className="py-6">{msg}</CardContent></Card>
  }

  if (embedded) {
    return <BreakupContent breakup={breakup} t={t} />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('priceBreakupTitle')}</CardTitle>
        {!hasFixedPrice && (
          <p className="text-xs text-muted">
            {t('liveRateLine', {
              purity: breakup.purity?.toUpperCase(),
              rate: formatINR(breakup.gold_rate),
            })}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <BreakupContent breakup={breakup} t={t} />
      </CardContent>
    </Card>
  )
}
