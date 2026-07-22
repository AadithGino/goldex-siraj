import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Search, Minus, Plus, Check } from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  useAdminInventoryVariants,
  useAdminLowStock,
  useAdjustVariantStock,
  useUpdateVariantStock,
  newIdempotencyKey,
} from '@/hooks/useAdminInventory'
import { ApiError } from '@/lib/api'

const PAGE_SIZE = 50

function StockAdjuster({ variant }) {
  const updateStock = useUpdateVariantStock()
  const adjustStock = useAdjustVariantStock()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(variant.stock_qty ?? 0))
  const pending = updateStock.isPending || adjustStock.isPending

  const commit = async () => {
    if (value === '' || value.trim() === '') {
      toast.error('Enter a valid stock quantity')
      return
    }
    const qty = Number(value)
    if (!Number.isInteger(qty) || qty < 0) {
      toast.error('Stock must be a non-negative integer')
      return
    }
    if (qty === (variant.stock_qty ?? 0)) { setEditing(false); return }
    try {
      await updateStock.mutateAsync({
        id: variant.id,
        stock_qty: qty,
        expected_before: variant.stock_qty ?? 0,
        idempotency_key: newIdempotencyKey(),
      })
      toast.success(`Stock updated to ${qty}`)
      setEditing(false)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'STOCK_VERSION_CONFLICT') {
        toast.error('Stock changed by another operator — list refreshed')
      } else {
        toast.error(err.message)
      }
      setValue(String(variant.stock_qty ?? 0))
      setEditing(false)
    }
  }

  const adjust = async (delta) => {
    try {
      await adjustStock.mutateAsync({
        id: variant.id,
        delta,
        idempotency_key: newIdempotencyKey(),
      })
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 w-20 text-center text-sm"
          autoFocus
          aria-label="Absolute stock quantity"
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') { setEditing(false); setValue(String(variant.stock_qty ?? 0)) }
          }}
        />
        <Button size="icon" variant="outline" className="h-8 w-8" onClick={commit} disabled={pending}>
          <Check className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon"
        variant="outline"
        className="h-7 w-7"
        onClick={() => adjust(-1)}
        disabled={pending || (variant.stock_qty ?? 0) === 0}
        aria-label="Decrease stock by 1"
      >
        <Minus className="h-3 w-3" />
      </Button>
      <button
        type="button"
        className={cn(
          'min-w-[40px] rounded-md px-2 py-0.5 text-center text-sm font-semibold tabular-nums hover:bg-ivory-3',
          variant.stock_qty === 0 ? 'text-[#b3261e]' :
          variant.stock_qty <= (variant.low_stock_threshold ?? 2) ? 'text-gold' : 'text-navy'
        )}
        onClick={() => { setValue(String(variant.stock_qty ?? 0)); setEditing(true) }}
      >
        {variant.stock_qty ?? 0}
      </button>
      <Button
        size="icon"
        variant="outline"
        className="h-7 w-7"
        onClick={() => adjust(1)}
        disabled={pending}
        aria-label="Increase stock by 1"
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  )
}

export function AdminInventoryPage() {
  const [tab, setTab] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => { setPage(1) }, [search, tab])

  const stockState = tab === 'all' ? 'all' : tab
  const { data, isLoading, isFetching } = useAdminInventoryVariants({
    page,
    limit: PAGE_SIZE,
    search,
    stock_state: stockState,
  })
  const { data: lowData } = useAdminLowStock({ page: 1, limit: 1 })

  const variants = data?.data || []
  const meta = data?.meta || {}
  const totalPages = Math.max(1, meta.pages || 1)
  const total = meta.total ?? 0
  const lowTotal = lowData?.meta?.total

  return (
    <div>
      <AdminPageHeader
        title="Inventory"
        description="Server-paginated stock for all product variants. Search covers SKU, label, and product name."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/stock-ledger">Stock ledger</Link>
          </Button>
        }
      />

      <div className="mb-4 flex gap-2">
        {[
          { key: 'all', label: `All${tab === 'all' ? ` (${total})` : ''}` },
          { key: 'low_stock', label: `Low stock${lowTotal != null ? ` (${lowTotal})` : ''}` },
          { key: 'out_of_stock', label: 'Out of stock' },
          { key: 'in_stock', label: 'In stock' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              tab === t.key
                ? 'border-[var(--navy)] bg-[var(--navy)] text-[var(--ivory-2)]'
                : 'border-gold/30 text-navy hover:border-gold'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            className="pl-9"
            placeholder="Search SKU, label, or product name…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search inventory"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : !variants.length ? (
        <div className="rounded-2xl border border-gold/20 bg-ivory-3 p-8 text-center text-sm text-muted">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-gold" />
          No variants match this page.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gold/20">
          <table className="w-full text-sm">
            <thead className="bg-ivory-3 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} className="border-t border-gold/10">
                  <td className="px-4 py-3 font-mono text-xs">{v.sku}</td>
                  <td className="px-4 py-3">{v.products?.name || '—'}</td>
                  <td className="px-4 py-3">{v.variant_label || v.label || '—'}</td>
                  <td className="px-4 py-3"><StockAdjuster variant={v} /></td>
                  <td className="px-4 py-3">
                    {(v.stock_qty ?? 0) === 0 ? (
                      <Badge variant="outline" className="text-[#b3261e]">Out</Badge>
                    ) : (v.stock_qty ?? 0) <= (v.low_stock_threshold ?? 2) ? (
                      <Badge variant="outline" className="text-gold">Low</Badge>
                    ) : (
                      <Badge variant="outline">OK</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Page {meta.page || page} of {totalPages} · {total} total
          {isFetching ? ' · refreshing…' : ''}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
