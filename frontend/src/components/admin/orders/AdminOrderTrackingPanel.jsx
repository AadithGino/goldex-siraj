import { useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ORDER_STATUS_LABELS } from '@/lib/constants'
import { useUpdateOrderStatus, ORDER_STATUS_FLOW } from '@/hooks/useAdminOrders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const FLOW = ['placed', 'confirmed', 'processing', 'shipped', 'delivered']

const STATUS_ACTION_LABELS = {
  confirmed: 'Confirm order',
  processing: 'Start processing',
  shipped: 'Mark shipped',
  delivered: 'Mark delivered',
  cancelled: 'Cancel order',
}

export function AdminOrderTrackingPanel({ order }) {
  const updateStatus = useUpdateOrderStatus()
  const [note, setNote] = useState('')

  if (!order) return null

  const allowedNext = ORDER_STATUS_FLOW[order.status] || []
  const reached = new Set(order.order_status_history?.map((h) => h.status) || [])
  reached.add(order.status)

  const activeIndex = FLOW.reduce(
    (max, status, index) => (reached.has(status) ? index : max),
    0
  )

  const isTerminal = order.status === 'cancelled' || order.status === 'returned'

  const handleQuickUpdate = async (status) => {
    // Require confirmation before cancelling an order
    if (status === 'cancelled') {
      const confirmed = window.confirm(
        `Cancel order ${order.order_number}? This cannot be undone.`
      )
      if (!confirmed) return
    }
    try {
      await updateStatus.mutateAsync({
        orderId: order.id,
        status,
        note: note.trim() || null,
      })
      toast.success(`Updated to ${ORDER_STATUS_LABELS[status]}`)
      setNote('')
    } catch (err) {
      toast.error(err.message || 'Update failed')
    }
  }

  const notePlaceholder =
    allowedNext.includes('shipped') && !note
      ? 'AWB / courier tracking (optional)'
      : 'Note to customer (optional)'

  return (
    <section className="rounded-lg border-2 border-navy/20 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-navy px-3 py-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gold-3">
          Fulfillment & tracking
        </h2>
        <span className="text-xs font-semibold text-gold-3/90">
          Current: {ORDER_STATUS_LABELS[order.status] || order.status}
        </span>
      </div>

      <div className="p-3">
        {isTerminal ? (
          <p className="text-sm font-medium text-[#b3261e]">
            Order {ORDER_STATUS_LABELS[order.status]?.toLowerCase()}
            {order.order_status_history?.slice(-1)[0]?.note && (
              <span className="mt-1 block text-xs font-normal text-muted">
                {order.order_status_history.slice(-1)[0].note}
              </span>
            )}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1">
              {FLOW.map((status, index) => {
                const done = index <= activeIndex
                const isCurrent = order.status === status
                return (
                  <div
                    key={status}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-1 rounded-md border px-2 py-1.5 text-[10px] font-semibold sm:text-xs',
                      done
                        ? 'border-navy/30 bg-ivory-3 text-navy'
                        : 'border-line bg-white text-muted',
                      isCurrent && 'ring-2 ring-gold/40'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]',
                        done ? 'bg-navy text-gold-3' : 'bg-line text-muted'
                      )}
                    >
                      {done ? '✓' : index + 1}
                    </span>
                    <span className="truncate">{ORDER_STATUS_LABELS[status]}</span>
                  </div>
                )
              })}
            </div>

            {allowedNext.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                  Update status
                </p>
                <div className="flex flex-wrap gap-2">
                  {allowedNext.map((status) => (
                    <Button
                      key={status}
                      type="button"
                      size="sm"
                      variant={status === 'cancelled' ? 'outline' : 'default'}
                      className={cn(
                        status === 'cancelled' && 'text-[#b3261e] hover:text-[#b3261e]',
                        status === 'shipped' && 'bg-gold text-navy hover:brightness-105'
                      )}
                      disabled={updateStatus.isPending}
                      onClick={() => handleQuickUpdate(status)}
                    >
                      {STATUS_ACTION_LABELS[status] || ORDER_STATUS_LABELS[status]}
                    </Button>
                  ))}
                </div>
                <Input
                  className="h-9 text-xs"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={notePlaceholder}
                />
                <p className="text-[10px] text-muted">
                  Tip: add courier AWB when marking shipped — customer sees it in tracking.
                </p>
              </div>
            )}
          </>
        )}

        {order.order_status_history?.length > 0 && (
          <div className="mt-3 border-t border-line pt-2">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
              History
            </p>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px]">
              {[...(order.order_status_history || [])].reverse().map((entry) => (
                <li key={entry.id} className="flex flex-wrap gap-x-2 text-muted">
                  <span className="font-medium text-navy">
                    {ORDER_STATUS_LABELS[entry.status] || entry.status}
                  </span>
                  <span>
                    {format(new Date(entry.created_at), 'dd MMM HH:mm')}
                  </span>
                  {entry.note && (
                    <span className="w-full text-navy/80">— {entry.note}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
