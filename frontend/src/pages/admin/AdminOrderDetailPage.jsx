import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Printer, AlertTriangle } from 'lucide-react'
import { formatDateSafe } from '@/lib/date'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { OrderStatusBadge } from '@/components/admin/shared/OrderStatusBadge'
import { OrderRequestBadges, getPendingOrderRequests } from '@/components/orders/OrderShared'
import { formatINR } from '@/lib/pricing'
import { useAdminOrder } from '@/hooks/useAdminOrders'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminOrderReturnsPanel } from '@/components/admin/orders/AdminOrderReturnsPanel'
import { AdminOrderItemsPanel } from '@/components/admin/orders/AdminOrderItemsPanel'
import { AdminOrderTrackingPanel } from '@/components/admin/orders/AdminOrderTrackingPanel'
import { AdminOrderFulfillmentSidebar } from '@/components/admin/orders/AdminOrderFulfillmentSidebar'
import { InvoiceNumber } from '@/components/shared/InvoiceNumber'
import { openOrderInvoice } from '@/lib/orderInvoice'
import { useStoreSettings } from '@/hooks/useStoreSettings'

export function AdminOrderDetailPage() {
  const { id } = useParams()
  const { data: order, isLoading, isError } = useAdminOrder(id)
  const { data: storeSettings } = useStoreSettings()

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-[28px]" />
        <Skeleton className="h-48 w-full rounded-[28px]" />
      </div>
    )
  }

  // SE4 fix: distinguish server/RLS errors from a genuinely missing order
  if (isError) {
    return (
      <div className="rounded-[28px] border border-gold/20 bg-ivory-2 p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-gold" />
        <p className="font-semibold text-navy">Failed to load order</p>
        <p className="mt-1 text-sm text-muted">A server error occurred. Check your connection and try again.</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
          <Button variant="ghost" size="sm" asChild><Link to="/admin/orders">Back to orders</Link></Button>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center text-muted">
        Order not found.
        <Button asChild className="mt-4 block" variant="outline" size="sm">
          <Link to="/admin/orders">Back to orders</Link>
        </Button>
      </div>
    )
  }

  const customer = order.customers
  const hasReturns = order.returns?.length > 0
  const pendingRequests = getPendingOrderRequests(order.returns, order.status)

  return (
    <div className="max-w-6xl">
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 h-8">
        <Link to="/admin/orders">
          <ChevronLeft className="h-4 w-4" />
          Orders
        </Link>
      </Button>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <AdminPageHeader
            title={order.order_number}
            description={
              <span className="flex flex-wrap items-center gap-2">
                {/* Customer link */}
                {customer?.id ? (
                  <Link
                    to={`/admin/customers/${customer.id}`}
                    className="text-navy hover:text-gold hover:underline"
                  >
                    {customer.full_name}
                  </Link>
                ) : (
                  <span>{customer?.full_name}</span>
                )}
                <span className="text-muted">·</span>
                <span>{formatDateSafe(order.placed_at, 'dd MMM yyyy · HH:mm')}</span>
                {/* Pending request badges in header */}
                {pendingRequests.length > 0 && (
                  <OrderRequestBadges returns={order.returns} orderStatus={order.status} />
                )}
              </span>
            }
            action={null}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <span className="font-display text-lg font-semibold text-gold">
            {formatINR(order.total)}
          </span>
          {order.payment_status === 'paid' && order.invoice_number ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openOrderInvoice(order, { store: storeSettings, autoPrint: true })}
            >
              <Printer className="h-4 w-4" />
              Print invoice
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openOrderInvoice(order, { store: storeSettings, autoPrint: false })}
            >
              <Printer className="h-4 w-4" />
              View invoice
            </Button>
          )}
        </div>
      </div>

      {order.invoice_number && (
        <div className="mb-3">
          <InvoiceNumber number={order.invoice_number} label="Invoice" compact />
        </div>
      )}

      {/* Priority 1: tracking */}
      <div className="mb-3 lg:sticky lg:top-20 lg:z-10">
        <AdminOrderTrackingPanel order={order} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_260px] lg:items-start">
        <div className="min-w-0 space-y-3">
          <AdminOrderItemsPanel order={order} />
          {hasReturns && (
            <AdminOrderReturnsPanel returns={order.returns} orderStatus={order.status} />
          )}
        </div>
        <AdminOrderFulfillmentSidebar order={order} />
      </div>
    </div>
  )
}
