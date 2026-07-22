import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAED } from '@/lib/pricing'
import { formatDateSafe } from '@/lib/date'
import {
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPaymentModeLabel,
  getPaymentStatusLabel,
} from '@/lib/i18nLabels'
import { useAdminCouponUsage } from '@/hooks/useAdminCoupons'

const USAGE_PAGE_SIZE = 20

function Cell({ children, className = '' }) {
  return <td className={`px-2 py-2 align-top text-xs ${className}`}>{children}</td>
}

function isRolledBack(row) {
  return row.status === 'rolled_back' || row.rolled_back_at != null
}

export function CouponUsageDialog({ open, onOpenChange, coupon }) {
  const couponId = coupon?.id || null
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const { data: usageResult, isLoading, error, isFetching } = useAdminCouponUsage(
    couponId,
    { page, limit: USAGE_PAGE_SIZE },
    open && !!couponId,
  )
  const usageRows = usageResult?.data ?? []
  const meta = usageResult?.meta
  const totalPages = Math.max(1, Number(meta?.pages) || 1)

  useEffect(() => {
    if (!open) return
    setPage(1)
  }, [open, couponId])

  useEffect(() => {
    if (!open || !couponId) return
    queryClient.invalidateQueries({ queryKey: ['admin-coupon-usage', couponId] })
    queryClient.invalidateQueries({ queryKey: ['admin-coupon-usage-summary'] })
  }, [open, couponId, queryClient])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Coupon usage · {coupon?.code || '—'}</DialogTitle>
          <DialogDescription>
            Orders and customers that redeemed this coupon, including rolled-back redemptions.
          </DialogDescription>
        </DialogHeader>

        {(isLoading || (isFetching && usageRows.length === 0)) && (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {!isLoading && error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error.message}
          </p>
        )}

        {!isLoading && !error && usageRows.length === 0 && (
          <p className="text-sm text-muted">No usage recorded for this coupon yet.</p>
        )}

        {!isLoading && !error && usageRows.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1280px] border-collapse">
                <thead>
                  <tr className="border-b border-line bg-ivory-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <th className="px-2 py-2">Customer</th>
                    <th className="px-2 py-2">Phone / email</th>
                    <th className="px-2 py-2">Order number</th>
                    <th className="px-2 py-2">Order status</th>
                    <th className="px-2 py-2">Payment</th>
                    <th className="px-2 py-2">Invoice</th>
                    <th className="px-2 py-2 text-right">Discount amount</th>
                    <th className="px-2 py-2">Used date</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Rollback</th>
                  </tr>
                </thead>
                <tbody>
                  {usageRows.map((row) => {
                    const rolledBack = isRolledBack(row)
                    const staff = row.rolled_back_by
                    return (
                      <tr key={row.redemption_id} className="border-b border-line/60">
                        <Cell className="font-medium text-navy">
                          {row.customer_id && row.customer_name ? (
                            <Link className="underline-offset-2 hover:underline" to={`/admin/customers/${row.customer_id}`}>
                              {row.customer_name}
                            </Link>
                          ) : (
                            row.customer_name || '—'
                          )}
                        </Cell>
                        <Cell className="text-muted">
                          <div>{row.customer_phone || '—'}</div>
                          <div>{row.customer_email || '—'}</div>
                        </Cell>
                        <Cell>
                          {row.order_id && row.order_number ? (
                            <Link className="font-medium text-navy underline-offset-2 hover:underline" to={`/admin/orders/${row.order_id}`}>
                              {row.order_number}
                            </Link>
                          ) : (
                            row.order_number || '—'
                          )}
                        </Cell>
                        <Cell>{getOrderStatusLabel(row.order_status)}</Cell>
                        <Cell className="text-muted">
                          <div>{getPaymentStatusLabel(row.payment_status)}</div>
                          <div>
                            {[getPaymentMethodLabel(row.payment_method), getPaymentModeLabel(row.payment_mode)]
                              .filter((part) => part && part !== '—')
                              .join(' · ') || '—'}
                          </div>
                        </Cell>
                        <Cell>{row.invoice_number || '—'}</Cell>
                        <Cell className="text-right font-semibold text-navy">
                          {formatAED(row.discount_amount || 0)}
                        </Cell>
                        <Cell>{formatDateSafe(row.created_at, 'dd MMM yyyy, HH:mm')}</Cell>
                        <Cell>
                          <Badge variant={rolledBack ? 'muted' : 'success'}>
                            {rolledBack ? 'Rolled back' : 'Active'}
                          </Badge>
                        </Cell>
                        <Cell className="text-muted">
                          {rolledBack ? (
                            <div className="space-y-0.5">
                              <div>{formatDateSafe(row.rolled_back_at, 'dd MMM yyyy, HH:mm')}</div>
                              <div>{row.rollback_reason || '—'}</div>
                              <div>
                                {staff?.full_name || staff?.email
                                  ? `By ${staff.full_name || staff.email}`
                                  : '—'}
                              </div>
                            </div>
                          ) : (
                            '—'
                          )}
                        </Cell>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {meta && (
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-muted">
                  Page {meta.page || page} of {totalPages} · {meta.total ?? 0} redemptions
                </p>
                {totalPages > 1 && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
