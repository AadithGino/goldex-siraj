import { useTranslation } from 'react-i18next'
import { TrendingUp } from 'lucide-react'
import { useGoldRate } from '@/hooks/useGoldRate'
import { formatAED } from '@/lib/pricing'

/** Slim navy bar showing today's gold rate per gram, AED. */
export function GoldRateTicker() {
  const { t } = useTranslation(['home', 'common'])
  const { data: rates, isLoading } = useGoldRate()

  if (isLoading || !rates?.length) return null

  return (
    <div className="rate-ticker overflow-x-clip">
      <div className="mx-auto max-w-[1320px] px-3 py-2 sm:px-6">
        <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex min-w-0 shrink-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3 lg:justify-start">
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold tracking-wide sm:text-sm">
              <TrendingUp className="h-4 w-4 shrink-0 text-gold-2" />
              {t('home:goldRateToday')}
            </span>
            <span className="text-[10px] leading-snug text-white/55 lg:hidden">
              {t('common:goldTickerFootnote')}
            </span>
          </div>

          <div className="rate-ticker-chips min-w-0 w-full lg:flex-1">
            {rates.map((r) => (
              <span
                key={r.id || r.purity}
                className="chip inline-flex shrink-0 items-center gap-1 whitespace-nowrap px-3 py-1 text-xs sm:text-sm"
              >
                <span className="text-white/70">{t(`home:purity.${r.purity}`, { defaultValue: r.purity })}</span>
                <span dir="ltr" className="inline-flex items-baseline gap-0.5 text-start">
                  <strong className="text-gold-2">{formatAED(r.rate_per_gram)}</strong>
                  <span className="text-white/50">{t('common:perGram')}</span>
                </span>
              </span>
            ))}
          </div>

          <span className="hidden shrink-0 text-xs text-white/55 lg:block">
            {t('common:goldTickerFootnote')}
          </span>
        </div>
      </div>
    </div>
  )
}
