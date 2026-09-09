import { useTranslation } from 'react-i18next'
import { TrendingUp } from 'lucide-react'
import { useGoldRate } from '@/hooks/useGoldRate'
import { formatAED } from '@/lib/pricing'

const PURITY_ORDER = ['24k', '22k', '21k', '18k', '14k']

function sortGoldRates(rates = []) {
  return [...rates].sort((a, b) => {
    const ai = PURITY_ORDER.indexOf(String(a.purity).toLowerCase())
    const bi = PURITY_ORDER.indexOf(String(b.purity).toLowerCase())
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
}

function RateChip({ rate, t }) {
  return (
    <span className="chip inline-flex shrink-0 items-center gap-1 whitespace-nowrap px-3 py-1 text-xs sm:text-sm">
      <span className="text-white/70">{t(`home:purity.${rate.purity}`, { defaultValue: rate.purity })}</span>
      <span dir="ltr" className="inline-flex items-baseline gap-0.5 text-start">
        <strong className="text-gold-2">{formatAED(rate.rate_per_gram)}</strong>
        <span className="text-white/50">{t('common:perGram')}</span>
      </span>
    </span>
  )
}

/** Slim navy bar showing today's gold rate per gram, AED. */
export function GoldRateTicker() {
  const { t } = useTranslation(['home', 'common'])
  const { data: rates, isLoading } = useGoldRate()

  if (isLoading || !rates?.length) return null

  const sorted = sortGoldRates(rates)
  const shouldScroll = sorted.length > 1

  return (
    <div className="rate-ticker overflow-x-clip">
      <div className="mx-auto flex max-w-[1320px] min-w-0 items-center gap-3 px-3 py-2 sm:gap-4 sm:px-6">
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold tracking-wide sm:text-sm">
          <TrendingUp className="h-4 w-4 shrink-0 text-gold-2" />
          {t('home:goldRateToday')}
        </span>

        <div
          className="min-w-0 flex-1 overflow-hidden"
          aria-label={t('common:goldRateTickerAria')}
        >
          <div
            dir="ltr"
            className={shouldScroll ? 'rate-ticker-marquee' : 'flex items-center gap-2'}
            style={shouldScroll ? { '--marquee-duration': `${Math.max(16, sorted.length * 5)}s` } : undefined}
          >
            {(shouldScroll ? [0, 1] : [0]).map((copy) => (
              <div
                key={copy}
                className="flex shrink-0 items-center gap-2 pe-2"
                aria-hidden={copy === 1 || undefined}
              >
                {sorted.map((rate) => (
                  <RateChip key={`${copy}-${rate.id || rate.purity}`} rate={rate} t={t} />
                ))}
              </div>
            ))}
          </div>
        </div>

        <span className="hidden shrink-0 text-xs text-white/55 lg:block">
          {t('common:goldTickerFootnote')}
        </span>
      </div>
    </div>
  )
}
