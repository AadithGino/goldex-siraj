import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useOrderReturns, useCreateReturn } from '@/hooks/useReturns'
import { getPendingOrderRequests } from '@/components/orders/OrderShared'

const RETURN_STATUS_VARIANT = {
  requested: 'gold',
  approved: 'outline',
  rejected: 'destructive',
  completed: 'success',
}

export function ReturnRequest({ order }) {
  const { t } = useTranslation(['orders', 'common', 'errors'])
  const { data: returns, isLoading } = useOrderReturns(order.id)
  const createReturn = useCreateReturn()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('cancellation')
  const [reason, setReason] = useState('')

  const pending = getPendingOrderRequests(returns, order.status)
  const canCancel = ['placed', 'confirmed', 'processing'].includes(order.status)
  const canReturn = order.status === 'delivered'
  const canRequest =
    !pending.length &&
    order.status !== 'cancelled' &&
    order.status !== 'returned' &&
    (canCancel || canReturn)

  useEffect(() => {
    if (canReturn && !canCancel) setKind('return')
    else if (canCancel) setKind('cancellation')
  }, [canCancel, canReturn])

  const kindLabel = (value) => (value === 'return' ? t('orders:return') : t('orders:cancellation'))

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await createReturn.mutateAsync({
        order_id: order.id,
        kind,
        reason,
      })
      toast.success(t('common:returnRequestSubmitted'))
      setOpen(false)
      setReason('')
    } catch (err) {
      toast.error(err.message || t('errors:orders.submitReturnFailed'))
    }
  }

  return (
    <div className="rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-6">
      <h2 className="font-display text-lg text-navy">{t('orders:returnsTitle')}</h2>

      {order.status === 'cancelled' && (
        <p className="mt-2 text-sm text-[#b3261e]">{t('orders:orderCancelled')}</p>
      )}

      {isLoading ? (
        <p className="mt-2 text-sm text-muted">{t('common:loading')}</p>
      ) : returns?.length ? (
        <div className="mt-4 space-y-3">
          {returns.map((r) => (
            <div key={r.id} className="rounded-2xl bg-ivory-3 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={RETURN_STATUS_VARIANT[r.status] || 'muted'}>
                  {t(`orders:returnStatus.${r.status}`, { defaultValue: r.status })}
                </Badge>
                <span className="text-muted">{kindLabel(r.kind)}</span>
              </div>
              <p className="mt-1 text-muted">{r.reason}</p>
              {r.resolution_note && (
                <p className="mt-2 text-xs text-navy">
                  {t('common:storeNote', { note: r.resolution_note })}
                </p>
              )}
              {r.status === 'requested' && (
                <p className="mt-2 text-xs text-gold">{t('common:waitingStoreReview')}</p>
              )}
              {r.status === 'approved' && r.kind === 'cancellation' && order.status !== 'cancelled' && (
                <p className="mt-2 text-xs text-muted">{t('common:cancellationApprovedNote')}</p>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {canRequest && !open && (
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setOpen(true)}>
          {t('orders:requestReturn')}
        </Button>
      )}

      {pending.length > 0 && order.status !== 'cancelled' && (
        <p className="mt-3 text-xs text-muted">
          {t('common:pendingRequestOnOrder', { kind: kindLabel(pending[0].kind) })}
        </p>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {canCancel && <SelectItem value="cancellation">{t('orders:cancellation')}</SelectItem>}
              {canReturn && <SelectItem value="return">{t('orders:return')}</SelectItem>}
            </SelectContent>
          </Select>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('orders:reasonPlaceholder')}
            required
            rows={3}
            className="w-full rounded-2xl border border-gold/20 bg-ivory px-4 py-3 text-sm"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={createReturn.isPending}>
              {t('orders:submitRequest')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t('common:cancel')}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
