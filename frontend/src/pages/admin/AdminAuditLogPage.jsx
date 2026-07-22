import { format } from 'date-fns'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useAdminAuditLog } from '@/hooks/useAdminAuditLog'
import { useStaffRole } from '@/hooks/useStaffRole'
import { cn } from '@/lib/utils'

const ENTITY_FILTERS = ['all', 'order', 'return', 'coupon', 'staff', 'gold_rate', 'scheme_enrollment']
const ACTION_FILTERS = [
  'all',
  'order_status_update',
  'order_mark_paid',
  'return_resolve',
  'coupon_create',
  'coupon_update',
  'coupon_delete',
  'staff_create',
  'staff_update',
  'gold_rate_set',
  'scheme_completion_credit',
]

const ACTION_LABELS = {
  order_status_update: 'Order status',
  order_mark_paid: 'Mark paid',
  return_resolve: 'Return resolve',
  coupon_create: 'Coupon created',
  coupon_update: 'Coupon updated',
  coupon_delete: 'Coupon deleted',
  staff_create: 'Staff created',
  staff_update: 'Staff updated',
  gold_rate_set: 'Gold rate',
  scheme_completion_credit: 'Scheme credit',
}

function entityLink(entityType, entityId) {
  if (!entityId) return null
  if (entityType === 'order') return `/admin/orders/${entityId}`
  if (entityType === 'return') return '/admin/returns'
  if (entityType === 'coupon') return '/admin/coupons'
  if (entityType === 'staff') return '/admin/staff'
  if (entityType === 'gold_rate') return '/admin/gold-rates'
  if (entityType === 'scheme_enrollment') return `/admin/schemes/enrollments/${entityId}`
  return null
}

function DetailsPreview({ details }) {
  if (!details || typeof details !== 'object') return null
  const entries = Object.entries(details).filter(([, v]) => v != null && v !== '')
  if (!entries.length) return null
  return (
    <ul className="mt-1 space-y-0.5 text-[11px] text-muted">
      {entries.slice(0, 4).map(([k, v]) => (
        <li key={k}>
          <span className="text-navy/70">{k.replace(/_/g, ' ')}:</span>{' '}
          {typeof v === 'object' ? JSON.stringify(v) : String(v)}
        </li>
      ))}
    </ul>
  )
}

export function AdminAuditLogPage() {
  const { canManageSettings } = useStaffRole()
  const [params, setParams] = useSearchParams()
  const entityType = params.get('entity') || 'all'
  const action = params.get('action') || 'all'
  const page = Math.max(1, Number(params.get('page')) || 1)

  const { data, isLoading, isError, error } = useAdminAuditLog({ entityType, action, page })
  const rows = data?.rows || []
  const total = data?.total || 0
  const pageSize = data?.pageSize || 50
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function setFilter(key, value) {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  if (!canManageSettings) {
    return (
      <div>
        <AdminPageHeader title="Audit log" description="Staff change history." />
        <p className="rounded-[28px] border border-gold/20 bg-ivory-2 p-6 text-sm text-muted">
          Only owners and managers can view the audit log.
        </p>
      </div>
    )
  }

  return (
    <div>
      <AdminPageHeader
        title="Audit log"
        description="Who changed orders, returns, rates, coupons, and staff settings."
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <span className="self-center text-[10px] font-bold uppercase text-muted">Entity</span>
        {ENTITY_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter('entity', f)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize',
              entityType === f ? 'border-navy bg-navy text-gold-3' : 'border-gold/30 text-navy'
            )}
          >
            {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <span className="self-center text-[10px] font-bold uppercase text-muted">Action</span>
        {ACTION_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter('action', f)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold',
              action === f ? 'border-navy bg-navy text-gold-3' : 'border-gold/30 text-navy'
            )}
          >
            {f === 'all' ? 'All' : ACTION_LABELS[f] || f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {isError && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#b3261e]">
          {error?.message || 'Could not load audit log'}
        </p>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-[28px]" />
      ) : !rows.length ? (
        <div className="rounded-[28px] border border-gold/20 bg-ivory-2 p-8 text-center text-sm text-muted">
          No audit entries yet.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const href = entityLink(row.entity_type, row.entity_id)
            const staffName = row.staff?.full_name || row.staff?.email || 'System'
            return (
              <div
                key={row.id}
                className="rounded-[20px] border border-gold/20 bg-ivory-2 p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="gold">{ACTION_LABELS[row.action] || row.action}</Badge>
                      <Badge variant="outline" className="capitalize">
                        {row.entity_type?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {format(new Date(row.created_at), 'dd MMM yyyy · HH:mm')} · {staffName}
                      {row.staff?.role ? ` (${row.staff.role})` : ''}
                    </p>
                  </div>
                  {href && (
                    <Button variant="outline" size="sm" asChild>
                      <Link to={href}>View</Link>
                    </Button>
                  )}
                </div>
                <DetailsPreview details={row.details} />
              </div>
            )
          })}

          <div className="flex items-center justify-between pt-2 text-xs text-muted">
            <span>{total} entr{total !== 1 ? 'ies' : 'y'}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => {
                  const next = new URLSearchParams(params)
                  next.set('page', String(page - 1))
                  setParams(next)
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => {
                  const next = new URLSearchParams(params)
                  next.set('page', String(page + 1))
                  setParams(next)
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
