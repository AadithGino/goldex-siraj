import { Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatINR } from '@/lib/pricing'

export function SchemePayDialog({ open, onOpenChange, installment }) {
  const { t } = useTranslation(['scheme'])
  if (!installment) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('scheme:payDialogTitle', { number: installment.installment_number })}</DialogTitle>
          <DialogDescription>{t('scheme:payDialogDesc', { amount: formatINR(installment.amount) })}</DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border border-gold/20 bg-ivory-2 p-4">
          <p className="flex items-center gap-2 font-medium text-navy"><Phone className="h-5 w-5 text-gold" /> Contact the store to pay</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">The store will arrange bank transfer, card, or cash payment with you. An owner or manager records the installment only after confirming the payment.</p>
        </div>
        <Button className="w-full" onClick={() => onOpenChange(false)}>Close</Button>
      </DialogContent>
    </Dialog>
  )
}
