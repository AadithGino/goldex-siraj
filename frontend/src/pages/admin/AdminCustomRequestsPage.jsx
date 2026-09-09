import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Badge } from '@/components/ui/badge'
import { useAdminCustomRequests } from '@/hooks/useAdminCustomRequests'
import { formatAED } from '@/lib/pricing'
import { cn } from '@/lib/utils'

const FILTERS = ['all', 'submitted', 'quoted', 'accepted', 'declined', 'cancelled', 'completed']
const STATUS_VARIANT = {
  submitted: 'gold',
  quoted: 'navy',
  accepted: 'success',
  declined: 'destructive',
  cancelled: 'muted',
  completed: 'success',
}

export function AdminCustomRequestsPage() {
  const [status, setStatus] = useState('submitted')
  const { data: requests, isLoading } = useAdminCustomRequests(status)
  const countsLabel = useMemo(
    () => `${requests?.length || 0} request${requests?.length === 1 ? '' : 's'}`,
    [requests],
  )

  return (
    <div>
      <AdminPageHeader
        title="Custom jewellery"
        description="Browse requests in the list, then open one to quote, decline, or complete."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatus(filter)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize',
                status === filter ? 'border-navy bg-navy text-gold-3' : 'border-gold/30 text-navy',
              )}
            >
              {filter}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{countsLabel}</p>
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        {requests?.map((request) => {
          const customer = request.customer || {}
          return (
            <Link
              key={request.id}
              to={`/admin/custom-requests/${request.id}`}
              className="flex items-center justify-between gap-3 rounded-[28px] border border-gold/20 bg-ivory-2 p-4 transition-colors hover:border-gold/40 sm:p-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-navy">{request.request_number}</span>
                  <Badge variant={STATUS_VARIANT[request.status] || 'muted'}>{request.status}</Badge>
                  <Badge variant="outline">{request.jewellery_type}</Badge>
                  <Badge variant="outline">{String(request.purity || '').toUpperCase()}</Badge>
                </div>
                <p className="mt-1 truncate text-sm text-muted">
                  {customer.full_name || customer.fullName || 'Customer'} · {customer.phone || '—'}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {request.gold_weight_grams} g
                  {request.budget_aed != null ? ` · budget ${formatAED(request.budget_aed)}` : ''}
                  {' · '}
                  {format(new Date(request.created_at), 'dd MMM yyyy')}
                  {request.quote?.total != null ? ` · quote ${formatAED(request.quote.total)}` : ''}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
            </Link>
          )
        })}
        {!isLoading && !requests?.length && <p className="text-sm text-muted">No custom requests.</p>}
      </div>
    </div>
  )
}
