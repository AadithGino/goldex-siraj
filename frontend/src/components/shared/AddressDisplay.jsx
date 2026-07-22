import { useTranslation } from 'react-i18next'
import { formatDubaiAddressLines } from '@/lib/addressFormat'
import { cn } from '@/lib/utils'

export function AddressDisplay({ address, compact = false, className }) {
  const { t } = useTranslation('common')
  const lines = formatDubaiAddressLines(address)
  if (!lines.length) {
    return <p className={cn('text-sm text-muted', className)}>{t('noAddressOnFile')}</p>
  }

  if (compact) {
    return (
      <p className={cn('text-sm leading-relaxed text-muted', className)}>
        {lines.join(' · ')}
      </p>
    )
  }

  return (
    <address className={cn('not-italic text-sm leading-relaxed text-muted', className)}>
      {lines.map((line, i) => (
        <span key={i} className={i === 0 ? 'block font-medium text-navy' : 'block'}>
          {line}
        </span>
      ))}
    </address>
  )
}

export function AddressDisplayMono({ address, className }) {
  const lines = formatDubaiAddressLines(address)
  return (
    <pre
      className={cn(
        'whitespace-pre-wrap rounded border border-line bg-ivory-3 p-2.5 font-mono text-[11px] leading-relaxed text-navy',
        className
      )}
    >
      {lines.join('\n') || '—'}
    </pre>
  )
}
