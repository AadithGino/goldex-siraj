import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RequireCustomer } from '@/components/auth/RequireCustomer'
import { OrderTimeline } from '@/components/account/OrderTimeline'
import { useOrder } from '@/hooks/useOrders'
import { formatINR } from '@/lib/pricing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ORDER_STATUS_VARIANT } from '@/lib/constants'
import {
  getOrderStatusLabel,
  getPaymentModeLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
} from '@/lib/i18nLabels'
import { ReturnRequest } from '@/components/account/ReturnRequest'
import { OrderItemsList, OrderRequestBadges } from '@/components/orders/OrderShared'
import { InvoiceNumber } from '@/components/shared/InvoiceNumber'
import { AddressDisplay } from '@/components/shared/AddressDisplay'
import { formatDateSafe } from '@/lib/date'
import { isEstimatedPricing, orderDisplayTotal } from '@/lib/orderAdapter'
import { openOrderInvoice } from '@/lib/orderInvoice'
import { useStoreSettings } from '@/hooks/useStoreSettings'

function OrderDetailContent() {
  const { t } = useTranslation(['orders', 'common', 'checkout'])
  const { id } = useParams()
  const { data: order, isLoading, error, refetch, isFetching } = useOrder(id)
  const { data: storeSettings } = useStoreSettings()

  if (isLoading || (isFetching && !order)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-40 w-full rounded-lg" />
      </div>
    )
  }

  if (error) {
    const notFound = error.status === 404
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6">
        <h1 className="font-display text-2xl text-navy">
          {notFound ? t('orders:notFound') : t('orders:loadErrorTitle')}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {notFound ? null : t('orders:loadErrorDesc')}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          {!notFound && (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t('common:retry', 'Retry')}
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to="/orders">{t('orders:backToOrders')}</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6">
        <h1 className="font-display text-2xl text-navy">{t('orders:notFound')}</h1>
        <Button asChild className="mt-4" variant="outline" size="sm">
          <Link to="/orders">{t('orders:backToOrders')}</Link>
        </Button>
      </div>
    )
  }

  const shipTo = order.ship_to || {}
  const estimated = isEstimatedPricing(order)
  const displayTotal = orderDisplayTotal(order)
  const collection = order.payment_collection
  const awaitingManual =
    order.payment_method === 'manual' && order.payment_status === 'pending'
  const verifiedManual =
    order.payment_method === 'manual' && order.payment_status === 'paid'

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2 h-8">
        <Link to="/orders">
          <ChevronLeft className="h-4 w-4" />
          {t('orders:allOrders')}
        </Link>
      </Button>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gold">{t('orders:orderEyebrow')}</p>
          <h1 className="font-display text-2xl text-navy sm:text-3xl">{order.order_number}</h1>
          <p className="mt-0.5 text-xs text-muted">
            {formatDateSafe(order.placed_at, 'dd MMM yyyy · hh:mm a')}
          </p>
          {order.invoice_number && (
            <div className="mt-2">
              <InvoiceNumber number={order.invoice_number} compact />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={ORDER_STATUS_VARIANT[order.status] || 'muted'}>
            {getOrderStatusLabel(order.status, t)}
          </Badge>
          <OrderRequestBadges returns={order.returns} orderStatus={order.status} />
          {order.is_gift && (
            <Badge variant="gold">{t('common:giftBadge')}</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => openOrderInvoice(order, { store: storeSettings, autoPrint: false })}
          >
            <Printer className="h-4 w-4" />
            {t('orders:viewDownloadInvoice', 'View / download invoice')}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <section className="rounded-lg border border-line bg-white p-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-navy">{t('orders:items')}</h2>
            <div className="mt-2">
              <OrderItemsList items={order.order_items} detailed />
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-3">
            <OrderTimeline history={order.order_status_history} currentStatus={order.status} />
          </section>

          <ReturnRequest order={order} />
        </div>

        <div className="space-y-3">
          <section className="rounded-lg border border-line bg-white p-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-navy">{t('orders:deliveryUae')}</h2>
            <div className="mt-2">
              <AddressDisplay address={shipTo} />
            </div>
          </section>

          {order.is_gift && (
            <section className="rounded-lg border border-line bg-white p-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-navy">{t('orders:giftNote')}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
                {order.gift_note?.trim() || t('common:noGiftMessage')}
              </p>
            </section>
          )}

          <section className="rounded-lg border border-line bg-white p-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-navy">{t('orders:payment')}</h2>
            <dl className="mt-2 space-y-1 text-sm">
              {estimated && (
                <div className="rounded-md border border-gold/30 bg-gold/10 px-2 py-1 text-xs text-navy">
                  <p className="font-semibold">{t('orders:estimatedUntilHandover')}</p>
                  <p>{t('orders:codPriceMayVary')}</p>
                </div>
              )}
              {awaitingManual && (
                <div className="rounded-md border border-gold/30 bg-gold/10 px-2 py-1 text-xs text-navy">
                  {t('orders:awaitingVerification')}
                </div>
              )}
              {verifiedManual && (
                <div className="rounded-md border border-[#2f7d4f]/30 bg-[#2f7d4f]/10 px-2 py-1 text-xs text-navy">
                  {t('orders:paymentVerified')}
                </div>
              )}

              <div className="flex justify-between">
                <dt className="text-muted">{t('orders:merchandiseSubtotal')}</dt>
                <dd>{formatINR(order.subtotal)}</dd>
              </div>
              {order.making_charge_total > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">{t('orders:makingChargeTotal')}</dt>
                  <dd>{formatINR(order.making_charge_total)}</dd>
                </div>
              )}
              {order.coupon_code && (
                <div className="flex justify-between">
                  <dt className="text-muted">{t('orders:coupon')} {order.coupon_code}</dt>
                  <dd className="text-[#2f7d4f]">−{formatINR(order.discount_amount || 0)}</dd>
                </div>
              )}
              {!order.coupon_code && Number(order.discount_amount) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">{t('orders:discount')}</dt>
                  <dd className="text-[#2f7d4f]">−{formatINR(order.discount_amount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">{t('orders:shipping')}</dt>
                <dd>{order.shipping_fee > 0 ? formatINR(order.shipping_fee) : t('orders:freeShipping')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t('orders:vat')}</dt>
                <dd>{formatINR(order.tax_amount)}</dd>
              </div>
              {order.tax_breakdown?.zero_rated_total > 0 && (
                <div className="flex justify-between text-xs">
                  <dt className="text-muted">Zero-rated (24KT)</dt>
                  <dd>{formatINR(order.tax_breakdown.zero_rated_total)}</dd>
                </div>
              )}
              {order.tax_breakdown?.standard_rated_total > 0 && (
                <div className="flex justify-between text-xs">
                  <dt className="text-muted">Standard-rated</dt>
                  <dd>{formatINR(order.tax_breakdown.standard_rated_total)}</dd>
                </div>
              )}
              {order.tax_breakdown?.exempt_total > 0 && (
                <div className="flex justify-between text-xs">
                  <dt className="text-muted">Exempt</dt>
                  <dd>{formatINR(order.tax_breakdown.exempt_total)}</dd>
                </div>
              )}
              {order.wallet_applied > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">{t('orders:walletApplied')}</dt>
                  <dd className="text-[#2f7d4f]">−{formatINR(order.wallet_applied)}</dd>
                </div>
              )}

              {estimated ? (
                <div className="flex justify-between border-t border-line pt-2 font-semibold text-navy">
                  <dt>{t('orders:estimatedTotal')}</dt>
                  <dd className="text-gold">{formatINR(displayTotal)}</dd>
                </div>
              ) : (
                <div className="flex justify-between border-t border-line pt-2 font-semibold text-navy">
                  <dt>{order.final_total != null ? t('orders:finalTotal') : t('orders:total')}</dt>
                  <dd className="text-gold">{formatINR(displayTotal)}</dd>
                </div>
              )}

              {order.amount_due != null && order.payment_status !== 'paid' && (
                <div className="flex justify-between font-semibold text-navy">
                  <dt>{t('orders:amountDue')}</dt>
                  <dd>{formatINR(order.amount_due)}</dd>
                </div>
              )}
              {collection?.amount != null && order.payment_status === 'paid' && (
                <div className="flex justify-between">
                  <dt className="text-muted">{t('orders:amountCollected')}</dt>
                  <dd>{formatINR(collection.amount)}</dd>
                </div>
              )}

              <div className="space-y-1 border-t border-line pt-2 text-[11px] text-muted">
                <p>{getPaymentMethodLabel(order.payment_method, t)}</p>
                {order.payment_mode && <p>{getPaymentModeLabel(order.payment_mode, t)}</p>}
                <p>{getPaymentStatusLabel(order.payment_status, t)}</p>
                <p>
                  {order.pricing_mode === 'cod_delivery'
                    ? t('orders:estimatedUntilHandover')
                    : t('orders:finalizedAtVerification')}
                </p>
                {order.paid_at && (
                  <p>{t('orders:paidAt')}: {formatDateSafe(order.paid_at, 'dd MMM yyyy · HH:mm')}</p>
                )}
                {order.finalized_at && (
                  <p>{t('orders:finalizedAt')}: {formatDateSafe(order.finalized_at, 'dd MMM yyyy · HH:mm')}</p>
                )}
                {collection?.transaction_ref_masked && (
                  <p>{t('orders:transactionReference')}: {collection.transaction_ref_masked}</p>
                )}
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}

export function OrderDetailPage() {
  return (
    <RequireCustomer>
      <OrderDetailContent />
    </RequireCustomer>
  )
}
