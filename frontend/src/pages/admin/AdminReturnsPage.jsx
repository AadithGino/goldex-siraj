import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useAdminReturns, useResolveReturn } from '@/hooks/useAdminReturns'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const FILTERS = ['all', 'requested', 'approved', 'rejected', 'completed']
const STATUS_VARIANT = { requested: 'muted', approved: 'gold', rejected: 'destructive', completed: 'success' }

export function AdminReturnsPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || 'requested'
  const { data: returns } = useAdminReturns(status)
  const resolve = useResolveReturn()
  const [notes, setNotes] = useState({})

  const handleResolve = async (id, newStatus) => {
    try {
      await resolve.mutateAsync({ id, status: newStatus, resolution_note: notes[id] || '' })
      toast.success(`Marked as ${newStatus}`)
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div>
      <AdminPageHeader title="Returns & cancellations" description="Resolve customer return requests." />
      <div className="mb-6 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setParams({ status: f })}
            className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize',
              status === f ? 'border-navy bg-navy text-gold-3' : 'border-gold/30 text-navy')}>{f}</button>
        ))}
      </div>
      <div className="space-y-3">
        {returns?.map((r) => (
          <div key={r.id} className="rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-navy">{r.orders?.order_number}</span>
              <Badge variant={STATUS_VARIANT[r.status] || 'muted'}>{r.status}</Badge>
              <Badge variant="outline">{r.kind}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted">
              {r.orders?.customers?.full_name} · {format(new Date(r.created_at), 'dd MMM yyyy')}
            </p>
            <p className="mt-2 text-sm text-muted">{r.reason}</p>
            {r.status === 'requested' && (
              <div className="mt-3 space-y-2">
                <Input value={notes[r.id] || ''} onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))} placeholder="Resolution note" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleResolve(r.id, 'approved')}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => handleResolve(r.id, 'rejected')}>Reject</Button>
                  <Button size="sm" variant="navy" onClick={() => handleResolve(r.id, 'completed')}>Complete & restock</Button>
                </div>
              </div>
            )}
            {r.resolution_note && <p className="mt-2 text-xs text-navy">Note: {r.resolution_note}</p>}
          </div>
        ))}
        {!returns?.length && <p className="text-sm text-muted">No requests.</p>}
      </div>
    </div>
  )
}
