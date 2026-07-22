import { useTranslation } from 'react-i18next'
import { formatINR } from '@/lib/pricing'
import { useGoldRate } from '@/hooks/useGoldRate'
import { Skeleton } from '@/components/ui/skeleton'
import { useStoreSettings } from '@/hooks/useStoreSettings'

export function TopBar() {
  const { t } = useTranslation('common')
  const { data: rates, isLoading } = useGoldRate()
  const { data: settings } = useStoreSettings()
  const primaryRate = rates?.find((r) => r.purity === '22k') || rates?.[0]
  const freeShip = settings?.free_shipping_above
  const phone = settings?.support_phone

  return (
    <div className="hidden bg-navy text-gold-3 md:block">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between px-4 py-2 text-xs sm:px-6">
        <p>
          {freeShip
            ? t('freeShippingAbove', { amount: formatINR(freeShip) })
            : t('freeShippingGeneric')}
        </p>
        <div className="flex items-center gap-4">
          {isLoading ? (
            <Skeleton className="h-4 w-32 bg-navy-2" />
          ) : primaryRate ? (
            <span className="font-semibold">
              {t('liveGoldRate', { rate: formatINR(primaryRate.rate_per_gram) })}
            </span>
          ) : null}
          {phone ? <span>{t('callPhone', { phone })}</span> : null}
        </div>
      </div>
    </div>
  )
}
