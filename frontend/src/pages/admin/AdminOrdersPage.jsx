import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { Search, Download, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { OrderStatusBadge } from '@/components/admin/shared/OrderStatusBadge'
import { OrderRequestBadges, getPendingOrderRequests } from '@/components/orders/OrderShared'
import { formatINR } from '@/lib/pricing'
import { useAdminOrders } from '@/hooks/useAdminOrders'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ORDER_STATUS_LABELS, getPaymentModeLabel, PAYMENT_STATUS_LABELS } from '@/lib/constants'
import { InvoiceNumber } from '@/components/shared/InvoiceNumber'

const FILTERS = [
  'all',
  'pending_requests',
  'placed',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
]

const FILTER_LABELS = {
  all: 'All',
  pending_requests: 'Needs action',
  ...ORDER_STATUS_LABELS,
}

function exportOrdersCsv(orders) {
  const header = [
    'Order #', 'Date', 'Customer', 'Phone', 'Email',
    'Status', 'Payment Method', 'Payment Status', 'Items', 'Total (AED)',
    'Invoice #',
  ]
  const rows = orders.map((o) => [
    o.order_number,
    format(new Date(o.placed_at), 'dd MMM yyyy HH:mm'),
    o.customers?.full_name || '',
    o.customers?.phone || '',
    o.customers?.email || '',
    o.status,
    getPaymentModeLabel(o.payment_mode) || o.payment_method || '',
    PAYMENT_STATUS_LABELS[o.payment_status] || o.payment_status || '',
    o.order_items?.length || 0,
    o.total,
    o.invoice_number || '',
  ])
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `orders-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function AdminOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') || 'all'

  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useAdminOrders({ status, search, dateFrom, dateTo, page })
  const orders = data?.orders || []
  const totalPages = data?.pages || 1
  const total = data?.total || 0

  const hasFilters = search || dateFrom || dateTo

  const clearFilters = () => {
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const handleStatusChange = (f) => {
    setSearchParams(f === 'all' ? {} : { status: f })
    setPage(1)
  }

  return (
    <div>
      <AdminPageHeader
        title="Orders"
        description="Fulfil orders, view customisations, and handle cancellation requests."
        action={
          orders?.length ? (
            <Button variant="outline" size="sm" onClick={() => exportOrdersCsv(orders)}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          ) : null
        }
      />

      {/* Status filters */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => handleStatusChange(f)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              status === f
                ? 'border-[var(--navy)] bg-[var(--navy)] text-[var(--ivory-2)]'
                : 'border-gold/30 text-navy hover:border-gold'
            )}
          >
            {FILTER_LABELS[f] || f}
          </button>
        ))}
      </div>

      {/* Search + date filter row */}
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search order #, customer, phone…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">From</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
            className="w-36"
          />
          <span className="text-xs text-muted">To</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
            className="w-36"
          />
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-full border border-gold/30 px-2 py-1 text-xs text-muted hover:text-navy"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-[28px]" />
      ) : !orders?.length ? (
        <div className="rounded-[28px] border border-gold/20 bg-ivory-2 p-8 text-center text-sm text-muted">
          {status === 'pending_requests'
            ? 'No pending return or cancellation requests.'
            : hasFilters
              ? 'No orders match your filters.'
              : 'No orders found.'}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {orders.map((order) => {
              const hasCustomization = order.order_items?.some((i) => i.customization_request)
              const pending = getPendingOrderRequests(order.returns, order.status)

              return (
                <Link
                  key={order.id}
                  to={`/admin/orders/${order.id}`}
                  className={cn(
                    'block rounded-[28px] border bg-ivory-2 p-4 transition-all hover:-translate-y-0.5 hover:border-gold/40 sm:p-5',
                    pending.length ? 'border-gold/50 ring-1 ring-gold/20' : 'border-gold/20'
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-lg text-navy">{order.order_number}</span>
                        <OrderStatusBadge status={order.status} />
                        <OrderRequestBadges returns={order.returns} orderStatus={order.status} />
                        {hasCustomization && (
                          <span className="rounded-full border border-gold/40 bg-ivory px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
                            Custom
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {order.customers?.full_name} · {order.customers?.phone}
                      </p>
                      <p className="text-xs text-muted">
                        {format(new Date(order.placed_at), 'dd MMM yyyy · hh:mm a')} ·{' '}
                        {order.order_items?.length || 0} items
                        {order.payment_mode && ` · ${getPaymentModeLabel(order.payment_mode)}`}
                        {order.payment_status && ` · ${PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}`}
                      </p>
                      {order.is_gift && (
                        <span className="mt-1 inline-block rounded-full border border-gold/40 bg-ivory px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
                          Gift
                        </span>
                      )}
                      {order.invoice_number && (
                        <div className="mt-1">
                          <InvoiceNumber number={order.invoice_number} compact />
                        </div>
                      )}
                      {hasCustomization && (
                        <p className="mt-1 line-clamp-1 text-xs text-navy">
                          ✦ {order.order_items.find((i) => i.customization_request)?.customization_request}
                        </p>
                      )}
                    </div>
                    <p className="font-display text-xl text-gold">{formatINR(order.total)}</p>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs text-muted">
              Page {page} of {totalPages} · {total} orders
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
