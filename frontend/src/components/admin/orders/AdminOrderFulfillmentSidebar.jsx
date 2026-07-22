import { formatAED } from '@/lib/pricing'
import { formatFulfillmentCopyBlock, formatPhoneUAE } from '@/lib/addressFormat'
import { CompactPanel, CopyTextButton } from '@/components/shared/CompactPanel'
import { AddressDisplayMono } from '@/components/shared/AddressDisplay'
import { AdminOrderPaymentPanel } from '@/components/admin/orders/AdminOrderPaymentPanel'
import { AdminOrderPaymentEventsPanel } from '@/components/admin/orders/AdminOrderPaymentEventsPanel'
import { Button } from '@/components/ui/button'
import { useMemo, useState } from 'react'
import { useFinalizeCodOrder, useMarkManualOrderPaid } from '@/hooks/useAdminActions'
import { useStaffRole } from '@/hooks/useStaffRole'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

function expectedCollectAmount(order) {
  if (order?.amount_due != null) return Number(order.amount_due)
  if (order?.final_total != null) return Number(order.final_total)
  if (order?.estimated_total != null) return Number(order.estimated_total)
  return Number(order?.total || 0)
}

export function AdminOrderFulfillmentSidebar({ order }) {
  const finalizeCod = useFinalizeCodOrder()
  const markManualPaid = useMarkManualOrderPaid()
  const { canRecordPayments } = useStaffRole()
  const [paymentMode, setPaymentMode] = useState('bank_transfer')
  const [transactionRef, setTransactionRef] = useState('')
  const [amountCollected, setAmountCollected] = useState('')
  const [amountConfirmed, setAmountConfirmed] = useState(false)
  const customer = order?.customers
  const shipTo = order?.ship_to || {}
  const copyBlock = formatFulfillmentCopyBlock({ order, customer })
  const expected = useMemo(() => expectedCollectAmount(order), [order])

  const parsedCollected = Number(amountCollected)
  const amountOk = Number.isFinite(parsedCollected)
    && parsedCollected > 0
    && Math.abs(parsedCollected - expected) <= 0.01

  const resetAmountUi = () => {
    setAmountCollected('')
    setAmountConfirmed(false)
  }

  return (
    <div className="space-y-2">
      <CompactPanel
        title="Ship to (UAE)"
        action={<CopyTextButton text={copyBlock} label="Copy all" />}
      >
        <dl className="mb-2 space-y-0.5 text-xs">
          <div>
            <dt className="text-muted">Customer</dt>
            <dd className="font-medium text-navy">{customer?.full_name}</dd>
          </div>
          <div>
            <dt className="text-muted">Phone</dt>
            <dd>{formatPhoneUAE(customer?.phone)}</dd>
          </div>
          {customer?.email && (
            <div>
              <dt className="text-muted">Email</dt>
              <dd className="break-all">{customer.email}</dd>
            </div>
          )}
        </dl>
        <AddressDisplayMono address={shipTo} />
      </CompactPanel>

      <AdminOrderPaymentPanel order={order} />

      {(order?.payment_status === 'paid' || order?.payment_events?.length) && (
        <AdminOrderPaymentEventsPanel orderId={order.id} events={order.payment_events} />
      )}

      {order?.pricing_mode === 'cod_delivery' && (
        <CompactPanel title="COD @ delivery">
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between">
              <dt className="text-muted">Estimate</dt>
              <dd>{formatAED(order.estimated_total)}</dd>
            </div>
            {order.final_total != null && (
              <div className="flex justify-between font-semibold">
                <dt>Final</dt>
                <dd>{formatAED(order.final_total)}</dd>
              </div>
            )}
            {order.amount_due != null && (
              <div className="flex justify-between border-t border-line pt-1 font-semibold text-navy">
                <dt>Collect</dt>
                <dd>{formatAED(order.amount_due)}</dd>
              </div>
            )}
          </dl>
          {!order.finalized_at && order.status === 'shipped' && canRecordPayments && (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] text-muted">
                Expected cash at handover: <strong className="text-navy">{formatAED(expected)}</strong>
                {' '}(live gold rate applied now). Enter the amount actually collected.
              </p>
              <Input
                className="h-9 text-xs"
                type="number"
                step="0.01"
                min="0"
                value={amountCollected}
                onChange={(event) => {
                  setAmountCollected(event.target.value)
                  setAmountConfirmed(false)
                }}
                placeholder="Amount collected (AED)"
              />
              <label className="flex items-start gap-2 text-[11px] text-navy">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={amountConfirmed}
                  onChange={(event) => setAmountConfirmed(event.target.checked)}
                />
                I confirm AED {Number.isFinite(parsedCollected) ? parsedCollected.toFixed(2) : '—'} was collected in cash.
              </label>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={finalizeCod.isPending || !amountOk || !amountConfirmed}
                onClick={async () => {
                  if (!window.confirm('Confirm the package is in the customer\'s hand and cash has been collected? The live gold rate will be applied now.')) return
                  try {
                    const r = await finalizeCod.mutateAsync({
                      orderId: order.id,
                      amountCollected: parsedCollected,
                    })
                    toast.success(`Delivered and collected: ${formatAED(r.final_total)}`)
                    resetAmountUi()
                  } catch (err) {
                    toast.error(err.message || 'Could not finalize')
                  }
                }}
              >
                {finalizeCod.isPending ? 'Completing handover…' : 'Confirm handover & collect cash'}
              </Button>
            </div>
          )}
          {!order.finalized_at && order.status !== 'shipped' && (
            <p className="mt-2 text-[11px] text-muted">Mark the order shipped before confirming physical handover.</p>
          )}
        </CompactPanel>
      )}

      {order?.payment_method === 'manual' && order.payment_status !== 'paid' && canRecordPayments && (
        <CompactPanel title="Verify bank / card payment">
          <div className="space-y-2">
            <p className="text-[11px] text-muted">
              Locked placement total: <strong className="text-navy">{formatAED(expected)}</strong>. Confirm the amount received before marking paid.
            </p>
            <select
              className="h-9 w-full rounded-md border border-line bg-white px-2 text-xs"
              value={paymentMode}
              onChange={(event) => setPaymentMode(event.target.value)}
            >
              <option value="bank_transfer">Bank transfer</option>
              <option value="card">Card</option>
            </select>
            <Input
              className="h-9 text-xs"
              value={transactionRef}
              onChange={(event) => setTransactionRef(event.target.value)}
              placeholder="Bank/card transaction reference"
            />
            <Input
              className="h-9 text-xs"
              type="number"
              step="0.01"
              min="0"
              value={amountCollected}
              onChange={(event) => {
                setAmountCollected(event.target.value)
                setAmountConfirmed(false)
              }}
              placeholder="Amount confirmed (AED)"
            />
            <label className="flex items-start gap-2 text-[11px] text-navy">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={amountConfirmed}
                onChange={(event) => setAmountConfirmed(event.target.checked)}
              />
              I confirm AED {Number.isFinite(parsedCollected) ? parsedCollected.toFixed(2) : '—'} was received.
            </label>
            <Button
              size="sm"
              className="w-full"
              disabled={!transactionRef.trim() || !amountOk || !amountConfirmed || markManualPaid.isPending}
              onClick={async () => {
                if (!window.confirm('Confirm this payment has been received and verified?')) return
                try {
                  const result = await markManualPaid.mutateAsync({
                    orderId: order.id,
                    paymentMode,
                    transactionRef: transactionRef.trim(),
                    amountCollected: parsedCollected,
                  })
                  toast.success(`Payment verified: ${formatAED(result.final_total)}`)
                  setTransactionRef('')
                  resetAmountUi()
                } catch (error) {
                  toast.error(error.message || 'Could not verify payment')
                }
              }}
            >
              {markManualPaid.isPending ? 'Verifying…' : 'Mark payment verified'}
            </Button>
          </div>
        </CompactPanel>
      )}
    </div>
  )
}
