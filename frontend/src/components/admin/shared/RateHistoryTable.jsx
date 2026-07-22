import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/pricing'
import { getStoneTypeLabel } from '@/lib/constants'
import { formatDateSafe } from '@/lib/date'
import { rateHistoryKey } from '@/lib/rateAdapters'

export function GoldRateHistoryTable({ rows = [] }) {
  if (!rows.length) return null

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div
          key={rateHistoryKey(r, 'gold')}
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gold/10 bg-ivory-2 px-4 py-3 text-sm"
        >
          <span className="font-medium text-navy">{r.purity?.toUpperCase()}</span>
          <span>{formatINR(r.rate_per_gram)}/g</span>
          <span className="text-muted">{formatDateSafe(r.effective_at, 'dd MMM yyyy')}</span>
          <span className="text-xs text-muted">{r.changed_by_name || 'System'}</span>
          {r.is_current && <Badge variant="success">Current</Badge>}
        </div>
      ))}
    </div>
  )
}

export function StoneRateHistoryTable({ rows = [], compact = false }) {
  if (!rows.length) return null

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div
          key={rateHistoryKey(r, 'stone')}
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gold/10 bg-ivory-2 px-4 py-3 text-sm"
        >
          {!compact && (
            <span className="font-medium capitalize text-navy">
              {getStoneTypeLabel(r.stone_type) || r.stone_type} · {r.grade}
            </span>
          )}
          <span className="text-gold">
            {formatINR(r.rate_per_unit)}/{r.unit === 'piece' ? 'pc' : 'ct'}
          </span>
          <span className="text-muted">{formatDateSafe(r.effective_at, 'dd MMM yyyy')}</span>
          <span className="text-xs text-muted">{r.changed_by_name || 'System'}</span>
          {r.is_current && <Badge variant="success">Current</Badge>}
        </div>
      ))}
    </div>
  )
}
