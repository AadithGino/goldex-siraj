import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { copyTextToClipboard } from '@/lib/addressFormat'

/** Dense admin/utility panel — avoids large rounded cards */
export function CompactPanel({ title, action, children, className }) {
  return (
    <section className={cn('rounded-lg border border-line bg-white', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          {title ? (
            <h3 className="text-xs font-bold uppercase tracking-wide text-navy">{title}</h3>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      <div className="p-3 text-sm">{children}</div>
    </section>
  )
}

export function CopyTextButton({ text, label }) {
  const { t } = useTranslation('common')

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await copyTextToClipboard(text)
          toast.success(t('copiedToClipboard'))
        } catch {
          toast.error(t('couldNotCopy'))
        }
      }}
      className="shrink-0 rounded border border-line px-2 py-1 text-[11px] font-semibold text-navy hover:bg-ivory-3"
    >
      {label ?? t('copy')}
    </button>
  )
}
