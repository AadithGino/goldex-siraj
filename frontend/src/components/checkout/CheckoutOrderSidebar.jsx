import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatINR } from '@/lib/pricing'
import { formatVariantSize } from '@/lib/constants'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'
import { CartSummary } from '@/components/cart/CartSummary'
import { Skeleton } from '@/components/ui/skeleton'

export function CheckoutOrderSidebar({
  linePrices = [],
  totals,
  isLoading,
  showCheckout = false,
  showLineItems = true,
  checkoutLabel,
  checkoutTo = '/checkout',
}) {
  const { t } = useTranslation(['checkout', 'common'])
  const lang = useContentLang()

  return (
    <div className="space-y-3">
      {showLineItems && linePrices.length > 0 && (
        <div className="rounded-lg border border-line bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-navy">
              {t('checkout:bagSidebarTitle', { count: linePrices.length })}
            </h3>
            <Link to="/cart" className="text-[11px] font-semibold text-gold hover:underline">
              {t('common:edit')}
            </Link>
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto p-2">
            {isLoading ? (
              <Skeleton className="h-12 w-full rounded-lg" />
            ) : (
              linePrices.map(({ item, lineTotal }) => {
                const product = item.product_variants?.products
                const variant = item.product_variants
                const image = product?.primary_image

                return (
                  <div key={item.id} className="flex gap-2 border-b border-line/60 pb-2 last:border-0 last:pb-0">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-line bg-ivory-3">
                      {image ? (
                        <img src={image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[9px] text-muted">
                          —
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-xs font-medium text-navy">
                        {product ? pickField(product, 'name', lang) : t('common:productFallback')}
                      </p>
                      <p className="text-[10px] text-muted">
                        {[formatVariantSize(variant), t('common:qty', { count: item.qty })]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-gold">
                      {lineTotal != null ? formatINR(lineTotal) : '—'}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      <CartSummary
        subtotal={totals.subtotal}
        discount={totals.discount}
        shipping={totals.shipping}
        taxAmount={totals.taxAmount}
        taxMode={totals.taxMode}
        taxActive={totals.taxPercent > 0}
        total={totals.total}
        isLoading={isLoading}
        showCheckout={showCheckout}
        checkoutLabel={checkoutLabel}
        checkoutTo={checkoutTo}
      />
    </div>
  )
}
