import { CompactPanel } from '@/components/shared/CompactPanel'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAED } from '@/lib/pricing'
import { formatDateSafe } from '@/lib/date'
import { useAdminPaymentEvents } from '@/hooks/useAdminPaymentEvents'

export function AdminOrderPaymentEventsPanel({ orderId, events: embeddedEvents }) {
  const { data: fetchedEvents, isLoading } = useAdminPaymentEvents(orderId)
  const events = embeddedEvents?.length ? embeddedEvents : fetchedEvents

  if (isLoading && !events?.length) {
    return (
      <CompactPanel title="Payment events">
        <Skeleton className="h-16 w-full" />
      </CompactPanel>
    )
  }

  if (!events?.length) {
    return (
      <CompactPanel title="Payment events">
        <p className="text-xs text-muted">No payment events recorded for this order yet.</p>
      </CompactPanel>
    )
  }

  return (
    <CompactPanel title={`Payment events (${events.length})`}>
      <ul className="space-y-3">
        {events.map((ev) => (
          <li key={ev.id || `${ev.event_type}-${ev.transaction_id}`} className="rounded-lg border border-line bg-ivory-3/50 p-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={ev.verified ? 'success' : 'muted'}>
                {ev.verified ? 'Verified' : 'Unverified'}
              </Badge>
              <span className="font-medium capitalize text-navy">{ev.provider || 'manual'}</span>
              <span className="text-muted">· {ev.event_type}</span>
            </div>
            <p className="mt-1 text-muted">
              {formatDateSafe(ev.processed_at || ev.created_at, 'dd MMM yyyy HH:mm')}
              {ev.amount != null && (
                <span className="ml-2 font-semibold text-navy">
                  {formatAED(ev.amount)} {ev.currency || 'AED'}
                </span>
              )}
            </p>
            {ev.transaction_id && (
              <p className="mt-1 break-all font-mono text-[10px] text-muted">
                Txn: {ev.transaction_id}
              </p>
            )}
          </li>
        ))}
      </ul>
    </CompactPanel>
  )
}
