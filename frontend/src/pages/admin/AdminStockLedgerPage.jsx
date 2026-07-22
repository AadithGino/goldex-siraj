import { useState } from 'react'
import { format } from 'date-fns'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useAdminStockMovements } from '@/hooks/useAdminStockLedger'
import { cn } from '@/lib/utils'

const REASON_FILTERS = [
  'all',
  'order_placed',
  'admin_adjustment',
  'order_cancelled',
  'order_returned',
]

const REASON_LABELS = {
  order_placed: 'Checkout',
  admin_adjustment: 'Manual adjust',
  order_cancelled: 'Cancelled',
  order_returned: 'Returned',
}

const REASON_VARIANT = {
  order_placed: 'destructive',
  admin_adjustment: 'gold',
  order_cancelled: 'outline',
  order_returned: 'outline',
}

function DeltaCell({ delta }) {
  const n = Number(delta)
  if (n > 0) return <span className="font-semibold text-[#2f7d4f]">+{n}</span>
  if (n < 0) return <span className="font-semibold text-[#b3261e]">{n}</span>
  return <span className="text-muted">0</span>
}

export function AdminStockLedgerPage() {
  const [params, setParams] = useSearchParams()
  const reason = params.get('reason') || 'all'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [search, setSearch] = useState(params.get('q') || '')

  const { data, isLoading } = useAdminStockMovements({ reason, search, page })
  const rows = data?.rows || []
  const total = data?.total || 0
  const pageSize = data?.pageSize || 50
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function goToPage(nextPage) {
    const next = new URLSearchParams(params)
    if (nextPage <= 1) next.delete('page')
    else next.set('page', String(nextPage))
    setParams(next)
  }

  return (
    <div>
      <AdminPageHeader
        title="Stock ledger"
        description="Immutable history of every inventory change — checkout, manual adjustments, cancellations, and returns."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/inventory">Current inventory</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {REASON_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params)
              if (f === 'all') next.delete('reason')
              else next.set('reason', f)
              next.delete('page')
              setParams(next)
            }}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize',
              reason === f ? 'border-navy bg-navy text-gold-3' : 'border-gold/30 text-navy'
            )}
          >
            {f === 'all' ? 'All' : REASON_LABELS[f] || f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            const next = new URLSearchParams(params)
            if (e.target.value.trim()) next.set('q', e.target.value.trim())
            else next.delete('q')
            next.delete('page')
            setParams(next)
          }}
          placeholder="Search SKU, product, note…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-[28px]" />
      ) : !rows.length ? (
        <div className="rounded-[28px] border border-gold/20 bg-ivory-2 p-8 text-center text-sm text-muted">
          No stock movements yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[28px] border border-gold/20 bg-ivory-2">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-gold/10 text-left text-[10px] font-bold uppercase tracking-wide text-muted">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Product / SKU</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 text-center">Δ</th>
                <th className="px-4 py-3 text-center">Before → After</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const pv = row.product_variants
                return (
                  <tr key={row.id} className="border-b border-gold/10 hover:bg-ivory-3/50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                      {format(new Date(row.created_at), 'dd MMM yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{pv?.products?.name || '—'}</p>
                      <p className="text-xs text-muted">
                        {pv?.variant_label && `${pv.variant_label} · `}
                        <span className="font-mono">{pv?.sku || row.variant_id?.slice(0, 8)}</span>
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={REASON_VARIANT[row.reason] || 'muted'}>
                        {REASON_LABELS[row.reason] || row.reason}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <DeltaCell delta={row.delta} />
                    </td>
                    <td className="px-4 py-3 text-center text-xs tabular-nums text-navy">
                      {row.qty_before ?? '—'} → {row.qty_after ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {row.reference_type === 'order' && row.reference_id ? (
                        <Link
                          to={`/admin/orders/${row.reference_id}`}
                          className="font-medium text-gold hover:underline"
                        >
                          Order
                        </Link>
                      ) : row.reference_type ? (
                        <span className="text-muted">{row.reference_type}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-xs text-muted" title={row.note || ''}>
                      {row.note || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-4 py-3 text-xs text-muted">
            <span>
              {total} movement{total !== 1 ? 's' : ''}
              {search ? ' (server-side search)' : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
