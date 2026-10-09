import { useTranslation } from 'react-i18next'
import { CreditCard } from 'lucide-react'
import { TabbyPromoSnippet } from '@/components/payments/TabbySnippet'
import { useStoreSettings } from '@/hooks/useStoreSettings'
import { getEnabledStorePaymentMethods } from '@/lib/storePaymentMethods'
import { cn } from '@/lib/utils'

/**
 * Official Tabby on-site snippet plus checkout method badges (no duplicate installment copy).
 * @param {'default'|'compact'} layout — PDP vs cart sidebar / quick view
 * @param {'product'|'cart'} tabbySource — TabbyPromo context
 */
export function ProductPaymentOptions({
  price,
  className,
  layout = 'default',
  tabbySource = 'product',
}) {
  const { t } = useTranslation(['product', 'nav', 'checkout'])
  const { data: settings } = useStoreSettings()
  const compact = layout === 'compact'
  const amount = Number(price)
  const hasPrice = Number.isFinite(amount) && amount > 0
  const methods = getEnabledStorePaymentMethods(settings)
  const tabbyOn = settings?.online_checkout_enabled && settings?.tabby_configured
  const otherMethods = methods.filter((m) => !(m.key === 'tabby' && tabbyOn))

  if (!hasPrice || (!tabbyOn && methods.length === 0)) return null

  return (
    <section
      className={cn(
        'rounded-lg border border-line',
        compact ? 'bg-white px-3 py-2.5' : 'mt-4 bg-ivory-3/80 px-3 py-3 sm:px-4',
        className,
      )}
      aria-label={t('product:paymentOptionsTitle')}
    >
      {compact ? (
        <p className="text-[10px] font-bold uppercase tracking-wide text-navy">
          {t('product:paymentOptionsTitle')}
        </p>
      ) : (
        <>
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-gold">
            {t('product:paymentOptionsEyebrow')}
          </p>
          <h3 className="mt-1 font-display text-sm text-navy sm:text-base">
            {t('product:paymentOptionsTitle')}
          </h3>
        </>
      )}

      {tabbyOn && (
        <div className={cn(compact ? 'mt-2' : 'mt-3')}>
          <TabbyPromoSnippet price={amount} source={tabbySource} />
        </div>
      )}

      {otherMethods.length > 0 && (
        <div
          className={cn(
            tabbyOn && 'border-t border-line',
            compact ? 'mt-2 pt-2' : 'mt-4 pt-3',
          )}
        >
          {!compact && (
            <p className="text-[11px] font-semibold text-navy">{t('product:alsoPayWith')}</p>
          )}
          <ul className={cn('flex flex-wrap items-center gap-1.5', !compact && 'mt-2 gap-2')}>
            {otherMethods.map((method) => {
              const label = t(method.labelKey)
              if (method.src) {
                return (
                  <li key={method.key}>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md border border-line bg-white',
                        compact ? 'px-1.5 py-0.5' : 'gap-1.5 px-2 py-1',
                      )}
                      title={label}
                    >
                      <img
                        src={method.src}
                        alt=""
                        className={cn('object-contain', compact ? 'h-3.5 max-w-[2.75rem]' : 'h-4 max-w-[3.5rem]')}
                      />
                      <span className="sr-only">{label}</span>
                    </span>
                  </li>
                )
              }
              return (
                <li key={method.key}>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md border border-line bg-white text-muted',
                      compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]',
                    )}
                  >
                    <CreditCard className="h-3 w-3 shrink-0 text-navy" aria-hidden />
                    {compact ? <span className="max-w-[5.5rem] truncate">{label}</span> : label}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
