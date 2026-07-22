import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatINR } from '@/lib/pricing'
import { usePriceBreakup } from '@/hooks/usePriceBreakup'
import { PriceBreakup } from '@/components/product/PriceBreakup'
import { CertificatePreview } from '@/components/product/CertificatePreview'
import { CertificateBadges } from '@/components/product/CertificateBadges'
import { certificatesForVariant } from '@/lib/certificates'
import { Skeleton } from '@/components/ui/skeleton'

function SummaryTable({ breakup, t }) {
  const stoneTotal = Array.isArray(breakup.stones)
    ? breakup.stones.reduce((s, row) => s + (Number(row.charge) || 0), 0)
    : Number(breakup.stone_charge) || 0

  const columns = [
    { label: t('product:breakup.goldValue'), value: formatINR(breakup.gold_value) },
    { label: t('product:breakupRow.wastageCharge').toUpperCase(), value: formatINR(breakup.wastage_amount || 0) },
    { label: t('product:breakup.makingChargeShort'), value: formatINR(breakup.making_charge) },
    {
      label: stoneTotal > 0 ? t('product:breakup.stoneCharge') : t('product:breakup.stone'),
      value: stoneTotal > 0 ? formatINR(stoneTotal) : '—',
    },
    {
      label: t('product:breakupRow.subtotalBeforeVat').toUpperCase(),
      value: formatINR(breakup.subtotal_before_vat ?? breakup.subtotal),
    },
  ]

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {columns.map((col) => (
          <div
            key={col.label}
            className="border-b border-line px-3 py-3 text-center last:border-b-0 sm:border-b sm:border-r sm:last:border-r-0"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted sm:text-[11px]">
              {col.label}
            </p>
            <p className="mt-2 text-sm font-semibold text-navy sm:text-base">{col.value}</p>
          </div>
        ))}
      </div>
      <div className="border-t border-line bg-ivory-3/80 px-4 py-3 text-center sm:text-right">
        <span className="text-xs text-muted">{t('product:breakupRow.itemPrice')} </span>
        <span className="font-display text-lg font-semibold text-gold">
          {formatINR(breakup.display_total ?? breakup.total)}
        </span>
      </div>
    </div>
  )
}

export function ProductPriceBreakupPanel({
  variantId,
  productId,
  certificates = [],
  id = 'price-breakup',
}) {
  const { t } = useTranslation(['product', 'common'])
  const [expanded, setExpanded] = useState(false)
  const { data: breakup, isLoading, error } = usePriceBreakup(variantId)
  const hasFixedPrice = breakup?.fixed_price != null || breakup?.price_override != null
  const certs = certificatesForVariant(certificates, variantId)
  const hasCerts = certs.length > 0

  return (
    <section id={id} className="scroll-mt-[calc(var(--storefront-header-height)+1rem)]">
      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-[0_1px_3px_rgba(20,33,61,0.04)]">
        {/* Header: title — line — toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-ivory-3/50 sm:gap-4 sm:px-5 sm:py-4"
          aria-expanded={expanded}
          aria-controls={`${id}-content`}
        >
          <h2 className="shrink-0 font-display text-lg text-navy sm:text-xl">{t('product:priceBreakUp')}</h2>
          <span
            className="h-px min-w-[2rem] flex-1 bg-gradient-to-r from-transparent via-line to-transparent sm:via-gold/30"
            aria-hidden
          />
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gold">
            {expanded ? t('common:showLess') : t('common:showMore')}
            <ChevronDown
              className={cn('h-4 w-4 transition-transform duration-300', expanded && 'rotate-180')}
            />
          </span>
        </button>

        {/* Collapsed preview: total hint + cert badges */}
        {!expanded && (
          <div className="border-t border-line/70 bg-gradient-to-b from-ivory-3/40 to-white px-4 pb-4 pt-3 sm:px-5">
            {isLoading && <Skeleton className="h-4 w-48" />}
            {breakup && !isLoading && (
              <p className="text-sm text-muted">
                {t('product:total')}{' '}
                <span className="font-semibold text-navy">{formatINR(breakup.display_total ?? breakup.total)}</span>
                <span className="text-muted/80">
                  {' '}
                  {t('product:priceBreakupExpandHint', {
                    certs: hasCerts ? t('product:andCertificates') : '',
                  })}
                </span>
              </p>
            )}
            {hasCerts && (
              <div className="mt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {t('product:certifications')}
                </p>
                <CertificateBadges certificates={certs} variantId={variantId} size="xs" />
              </div>
            )}
          </div>
        )}

        {/* Expanded content */}
        <div
          id={`${id}-content`}
          className={cn(
            'grid border-t border-line/70 bg-ivory-3/30 transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
            expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          )}
        >
          <div className="overflow-hidden">
            <div className="space-y-5 px-4 py-5 sm:px-5 sm:py-6">
              {isLoading && (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-32 w-full rounded-lg" />
                </div>
              )}

              {error && !isLoading && (
                <p className="text-sm text-muted">{t('product:priceBreakupLoadFailed')}</p>
              )}

              {breakup && !isLoading && (
                <>
                  {hasFixedPrice ? (
                    <div className="rounded-lg border border-line bg-white p-5 text-center">
                      <p className="font-display text-2xl text-gold">
                        {formatINR(breakup.display_total ?? breakup.total)}
                      </p>
                      <p className="mt-2 text-sm text-muted">{t('product:fixedPriceVariant')}</p>
                    </div>
                  ) : (
                    <>
                      <SummaryTable breakup={breakup} t={t} />
                      {breakup.gold_rate && (
                        <p className="text-xs text-muted">
                          {t('product:liveGoldRateLine', {
                            purity: breakup.purity?.toUpperCase(),
                            rate: formatINR(breakup.gold_rate),
                          })}
                        </p>
                      )}
                    </>
                  )}

                  <div className="rounded-lg border border-line bg-white p-4 sm:p-5">
                    <h3 className="mb-4 text-sm font-semibold text-navy">{t('product:detailedBreakdown')}</h3>
                    <PriceBreakup variantId={variantId} embedded />
                  </div>

                  {hasCerts && (
                    <div className="rounded-lg border border-line bg-white p-4 sm:p-5">
                      <h3 className="mb-4 text-sm font-semibold text-navy">{t('product:certificationDetails')}</h3>
                      <CertificatePreview
                        productId={productId}
                        variantId={variantId}
                        certificates={certificates}
                        embedded
                      />
                    </div>
                  )}

                  <p className="text-xs leading-relaxed text-muted sm:text-sm">
                    {t('product:shippingDiscountCheckoutNote')}
                  </p>
                  <p className="text-xs leading-relaxed text-muted sm:text-sm">
                    {t('product:priceUpdateNote')}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
