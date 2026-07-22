import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function InvoiceNumber({
  number,
  label,
  className,
  compact = false,
}) {
  const { t } = useTranslation('common')
  const [copied, setCopied] = useState(false)
  const displayLabel = label ?? t('invoice')

  if (!number) return null

  const handleCopy = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(number)
      setCopied(true)
      toast.success(t('invoiceCopied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('couldNotCopy'))
    }
  }

  if (compact) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs text-muted', className)}>
        <span className="font-medium text-navy">{displayLabel}:</span>
        <span>{number}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded p-0.5 hover:text-gold"
          aria-label={t('copyInvoiceAria')}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </span>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border border-gold/20 bg-ivory-3 px-3 py-2',
        className
      )}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{displayLabel}</p>
        <p className="truncate font-mono text-sm font-medium text-navy">{number}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded-lg border border-gold/20 p-2 text-muted hover:border-gold/40 hover:text-gold"
        aria-label={t('copyInvoiceAria')}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  )
}
