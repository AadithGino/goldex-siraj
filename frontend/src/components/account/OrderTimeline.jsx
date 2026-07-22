import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { getOrderStatusLabel } from '@/lib/i18nLabels'
import { formatDateSafe, parseDateSafe } from '@/lib/date'

const FLOW = ['placed', 'confirmed', 'processing', 'shipped', 'delivered']

export function OrderTimeline({ history, currentStatus }) {
  const { t } = useTranslation(['orders', 'common'])

  if (currentStatus === 'cancelled' || currentStatus === 'returned') {
    const latest = history?.[history.length - 1]
    return (
      <div className="rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-6">
        <p className="text-sm font-medium text-[#b3261e]">
          {t('orders:orderStatusCancelledReturned', {
            status: getOrderStatusLabel(currentStatus, t).toLowerCase(),
          })}
        </p>
        {latest?.note && <p className="mt-2 text-sm text-muted">{latest.note}</p>}
        {parseDateSafe(latest?.created_at) && (
          <p className="mt-1 text-xs text-muted">
            {formatDateSafe(latest.created_at, 'dd MMM yyyy · HH:mm')}
          </p>
        )}
      </div>
    )
  }

  const reached = new Set(history?.map((h) => h.status) || [])
  if (currentStatus) reached.add(currentStatus)

  const activeIndex = FLOW.reduce(
    (max, status, index) => (reached.has(status) ? index : max),
    0
  )

  return (
    <div className="rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-6">
      <h3 className="font-display text-lg text-navy">{t('orders:tracking')}</h3>
      <ol className="mt-6 space-y-0">
        {FLOW.map((status, index) => {
          const entry = history?.find((h) => h.status === status)
          const done = index <= activeIndex
          const isLast = index === FLOW.length - 1

          return (
            <li key={status} className="relative flex gap-4 pb-6 last:pb-0">
              {!isLast && (
                <span
                  className={cn(
                    'absolute start-[15px] top-8 h-full w-px',
                    done ? 'bg-gold' : 'bg-gold/20'
                  )}
                />
              )}
              <div
                className={cn(
                  'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
                  done
                    ? 'border-gold bg-gold text-navy'
                    : 'border-gold/20 bg-ivory-2 text-muted'
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <span className="text-xs">{index + 1}</span>}
              </div>
              <div className="min-w-0 pt-0.5">
                <p className={cn('font-medium', done ? 'text-navy' : 'text-muted')}>
                  {getOrderStatusLabel(status, t)}
                </p>
                {parseDateSafe(entry?.created_at) && (
                  <p className="text-xs text-muted">
                    {formatDateSafe(entry.created_at, 'dd MMM yyyy · HH:mm')}
                  </p>
                )}
                {entry?.note && <p className="mt-1 text-xs text-muted">{entry.note}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
