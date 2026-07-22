import { useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useResolveReturn } from '@/hooks/useAdminReturns'
import { canActOnReturnRequest } from '@/components/orders/OrderShared'
import { CompactPanel } from '@/components/shared/CompactPanel'

const STATUS_VARIANT = {
  requested: 'gold',
  approved: 'outline',
  rejected: 'destructive',
  completed: 'success',
}

export function AdminOrderReturnsPanel({ returns = [], orderStatus }) {
  const resolve = useResolveReturn()
  const [notes, setNotes] = useState({})

  if (!returns.length) return null

  const handleResolve = async (id, newStatus) => {
    try {
      await resolve.mutateAsync({
        id,
        status: newStatus,
        resolution_note: notes[id] || '',
      })
      toast.success(
        newStatus === 'approved' || newStatus === 'completed'
          ? 'Request updated — order status synced'
          : `Marked as ${newStatus}`
      )
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <CompactPanel title="Returns & cancellations">
      <div className="space-y-2">
        {returns.map((r) => {
          const canAct = canActOnReturnRequest(r, orderStatus)
          const isDone =
            r.kind === 'cancellation' && orderStatus === 'cancelled' && r.status !== 'rejected'

          return (
            <div key={r.id} className="rounded-lg border border-line bg-ivory-3 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_VARIANT[isDone ? 'completed' : r.status] || 'muted'} className="capitalize">
                  {isDone && r.status === 'approved' ? 'completed' : r.status}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {r.kind}
                </Badge>
                <span className="text-xs text-muted">
                  {format(new Date(r.created_at), 'dd MMM yyyy · hh:mm a')}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">{r.reason}</p>
              {r.resolution_note && (
                <p className="mt-2 text-xs text-navy">Resolution: {r.resolution_note}</p>
              )}
              {isDone && orderStatus === 'cancelled' && (
                <p className="mt-2 text-xs text-muted">Order cancelled — no further action needed.</p>
              )}
              {canAct && (
                <div className="mt-3 space-y-2">
                  <Input
                    value={notes[r.id] || ''}
                    onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                    placeholder="Note to customer (optional)"
                  />
                  <div className="flex flex-wrap gap-2">
                    {r.kind === 'cancellation' ? (
                      <>
                        <Button size="sm" onClick={() => handleResolve(r.id, 'approved')}>
                          Approve & cancel order
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleResolve(r.id, 'rejected')}>
                          Reject
                        </Button>
                      </>
                    ) : r.status === 'requested' ? (
                      <>
                        <Button size="sm" onClick={() => handleResolve(r.id, 'approved')}>
                          Approve return
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleResolve(r.id, 'rejected')}>
                          Reject
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="navy" onClick={() => handleResolve(r.id, 'completed')}>
                          Complete & restock
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleResolve(r.id, 'rejected')}>
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </CompactPanel>
  )
}
