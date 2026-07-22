import { useEffect, useState } from 'react'
import { Banknote, CreditCard, Landmark } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatAED } from '@/lib/pricing'
import { SCHEME_PAYMENT_METHODS_ADMIN } from '@/lib/schemeUtils'
import { useAdminSchemeMutations } from '@/hooks/useSchemes'
import { cn } from '@/lib/utils'
import { formatSchemeError } from '@/lib/schemeErrors'
import { SchemePayloadError, toInstallmentPayPayload } from '@/lib/schemePayload'

const METHOD_ICONS = {
  card: CreditCard,
  bank_transfer: Landmark,
  cash: Banknote,
}

export function SchemeRecordPaymentDialog({
  open,
  onOpenChange,
  installment,
  onSuccess,
  canRecordSchemePayments = true,
}) {
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [transactionRef, setTransactionRef] = useState('')
  const recordPayment = useAdminSchemeMutations().recordPayment
  const needsRef = method === 'bank_transfer' || method === 'card'

  useEffect(() => {
    if (open) {
      setMethod('cash')
      setNote('')
      setTransactionRef('')
    }
  }, [open, installment?.id])

  const handleRecord = async () => {
    if (!installment) return
    if (!canRecordSchemePayments) {
      toast.error(formatSchemeError('unauthorized'))
      return
    }
    let payload
    try {
      payload = toInstallmentPayPayload({
        amount: installment.amount,
        payment_method: method,
        transaction_ref: transactionRef,
        note: note.trim() || undefined,
      })
    } catch (err) {
      toast.error(err instanceof SchemePayloadError ? err.message : 'Invalid payment values')
      return
    }
    try {
      const result = await recordPayment.mutateAsync({
        installmentId: installment.id,
        amount: payload.amount,
        paymentMethod: payload.payment_method,
        transactionRef: payload.transaction_ref,
        note: payload.note,
      })
      if (result?.invoice_number) {
        toast.success(`Payment recorded. Invoice: ${result.invoice_number}`)
      } else if (result?.idempotent) {
        toast.success('Payment already recorded.')
      } else {
        toast.success('Installment payment recorded successfully.')
      }
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      toast.error(formatSchemeError(err))
    }
  }

  if (!installment) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment · #{installment.installment_number}</DialogTitle>
          <DialogDescription>
            Amount: {formatAED(installment.amount)} · Select how the customer paid at the store
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {SCHEME_PAYMENT_METHODS_ADMIN.map((m) => {
            const Icon = METHOD_ICONS[m.value] || CreditCard
            const selected = method === m.value
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors',
                  selected
                    ? 'border-gold bg-gold/10'
                    : 'border-gold/20 bg-ivory-2 hover:border-gold/40'
                )}
              >
                <Icon className={cn('h-5 w-5', selected ? 'text-gold' : 'text-muted')} />
                <div>
                  <p className="font-medium text-navy">{m.label}</p>
                  <p className="text-xs text-muted">{m.description}</p>
                </div>
              </button>
            )
          })}
        </div>

        {needsRef && (
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Transaction reference *</label>
            <Input
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="Bank/card reference"
              required
            />
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-navy">Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Received at counter, receipt #123"
            className="w-full rounded-2xl border border-gold/20 bg-ivory px-4 py-3 text-sm"
          />
        </div>

        {!canRecordSchemePayments && (
          <p className="text-xs text-muted">
            You do not have permission to record scheme payments.
          </p>
        )}
        <Button
          className="w-full"
          onClick={handleRecord}
          disabled={recordPayment.isPending || !canRecordSchemePayments}
        >
          {recordPayment.isPending
            ? 'Recording…'
            : `Record ${formatAED(installment.amount)} as paid`}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
