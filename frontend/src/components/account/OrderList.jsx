import { Link } from 'react-router-dom'
import { Package } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatINR } from '@/lib/pricing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { OrderRequestBadges, productImageSrc } from '@/components/orders/OrderShared'
import { InvoiceNumber } from '@/components/shared/InvoiceNumber'
import { ORDER_STATUS_VARIANT } from '@/lib/constants'
import { formatDateSafe } from '@/lib/date'
import { isEstimatedPricing, orderDisplayTotal } from '@/lib/orderAdapter'
import {
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
} from '@/lib/i18nLabels'

export function OrderList({ orders, isLoading, isError, onRetry }) {
  const { t } = useTranslation(['orders', 'common', 'checkout'])

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-28 w-full rounded-[28px]" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-[28px] border border-gold/20 bg-ivory-2 px-6 py-10 text-center">
        <p className="font-display text-xl text-navy">{t('orders:loadErrorTitle')}</p>
        <p className="mt-2 text-sm text-muted">{t('orders:loadErrorDesc')}</p>
        {onRetry && (
          <Button className="mt-4" variant="outline" onClick={onRetry}>
            {t('common:retry', 'Retry')}
          </Button>
        )}
      </div>
    )
  }

  if (!orders?.length) {
    return (
      <div className="flex flex-col items-center rounded-[28px] border border-gold/20 bg-ivory-2 px-6 py-12 text-center">
        <Package className="h-10 w-10 text-gold" />
        <p className="mt-4 font-display text-xl text-navy">{t('orders:emptyTitle')}</p>
        <p className="mt-2 text-sm text-muted">{t('orders:emptyDesc')}</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/search">{t('common:startShopping')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const items = order.order_items || []
        const first = items[0]
        const more = Math.max(items.length - 1, 0)
        const amount = orderDisplayTotal(order)
        const estimated = isEstimatedPricing(order)
        const thumbs = items.slice(0, 3)

        return (
          <Link
            key={order.id}
            to={`/orders/${order.id}`}
            className="block rounded-[28px] border border-gold/20 bg-ivory-2 p-4 transition-all hover:-translate-y-0.5 hover:border-gold/40 sm:p-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg text-navy">{order.order_number}</span>
                  <Badge variant={ORDER_STATUS_VARIANT[order.status] || 'muted'}>
                    {getOrderStatusLabel(order.status, t)}
                  </Badge>
                  <OrderRequestBadges returns={order.returns} orderStatus={order.status} />
                  {order.coupon_code && (
                    <Badge variant="outline">{t('orders:coupon')} {order.coupon_code}</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatDateSafe(order.placed_at, 'dd MMM yyyy · hh:mm a')}
                </p>
                {order.invoice_number && (
                  <div className="mt-2">
                    <InvoiceNumber number={order.invoice_number} compact />
                  </div>
                )}
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {thumbs.map((item) => (
                      <img
                        key={item.id || item.sku || item.product_name}
                        src={productImageSrc(item.image_url)}
                        alt={item.product_name || t('orders:items')}
                        className="h-10 w-10 rounded-full border-2 border-ivory-2 object-cover"
                        loading="lazy"
                      />
                    ))}
                  </div>
                  <div className="min-w-0 text-xs text-muted">
                    <p className="truncate text-navy">
                      {first?.product_name || t('orders:items')}
                      {more > 0 ? ` + ${more} ${t('orders:more')}` : ''}
                    </p>
                    <p>{t('common:itemCount', { count: items.length })}</p>
                  </div>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="font-display text-xl text-gold">{formatINR(amount)}</p>
                {estimated && (
                  <p className="text-[10px] uppercase tracking-wide text-muted">{t('orders:estimatedTotal')}</p>
                )}
                <p className="text-xs uppercase tracking-wide text-muted">
                  {getPaymentMethodLabel(order.payment_method, t)}
                </p>
                <p className="text-xs text-muted">
                  {getPaymentStatusLabel(order.payment_status, t)}
                </p>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
