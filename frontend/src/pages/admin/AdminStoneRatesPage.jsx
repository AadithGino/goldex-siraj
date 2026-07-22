import { useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, History } from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { StoneRateHistoryTable } from '@/components/admin/shared/RateHistoryTable'
import { Button } from '@/components/ui/button'
import { useAdminStoneRates, useAdminStoneRateMutations } from '@/hooks/useAdminStoneRates'
import { StoneRateFormDialog } from '@/components/admin/stones/StoneRateFormDialog'
import { useStaffRole } from '@/hooks/useStaffRole'
import { formatINR } from '@/lib/pricing'
import { getStoneTypeLabel } from '@/lib/constants'
import { compareRatesByEffectiveAt, rateHistoryKey } from '@/lib/rateAdapters'
import { cn } from '@/lib/utils'

function stoneKey(r) {
  return `${r.stone_type}|${r.grade}|${r.unit}`
}

export function AdminStoneRatesPage() {
  const { canManageCatalog } = useStaffRole()
  const { data: rates } = useAdminStoneRates()
  const { removeStone } = useAdminStoneRateMutations()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selected, setSelected] = useState(null)

  const currentRates = useMemo(
    () => (rates || []).filter((r) => r.is_current),
    [rates]
  )

  const selectedHistory = useMemo(() => {
    if (!selected || !rates?.length) return []
    const key = stoneKey(selected)
    return rates
      .filter((r) => stoneKey(r) === key)
      .slice()
      .sort(compareRatesByEffectiveAt)
  }, [selected, rates])

  if (!canManageCatalog) return <p className="text-muted">No permission.</p>

  const selectedLabel = selected
    ? `${getStoneTypeLabel(selected.stone_type) || selected.stone_type} · ${selected.grade}`
    : null

  return (
    <div>
      <AdminPageHeader
        title="Stone rates"
        description="Dynamic rate card for diamonds and gemstones. Click a stone to view its price history."
        action={
          <Button onClick={() => { setEditing(null); setOpen(true) }}>
            <Plus className="h-4 w-4" /> Add stone
          </Button>
        }
      />

      <div className="mb-8 space-y-3">
        <h2 className="font-display text-lg text-navy">Current rates</h2>
        {!currentRates.length && (
          <p className="text-sm text-muted">No rates yet. Run migration 013 or add manually.</p>
        )}
        {currentRates.map((r) => {
          const isSelected = selected && stoneKey(selected) === stoneKey(r)
          return (
            <div
              key={rateHistoryKey(r, 'stone-current')}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(isSelected ? null : r)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelected(isSelected ? null : r)
                }
              }}
              className={cn(
                'flex cursor-pointer items-center justify-between rounded-[28px] border p-4 transition-colors sm:p-5',
                isSelected
                  ? 'border-gold bg-ivory ring-2 ring-gold/30'
                  : 'border-gold/20 bg-ivory-2 hover:border-gold/40'
              )}
            >
              <div>
                <p className="font-medium capitalize text-navy">
                  {getStoneTypeLabel(r.stone_type) || r.stone_type} · {r.grade}
                </p>
                <p className="text-sm text-gold">
                  {formatINR(r.rate_per_unit)}/{r.unit === 'piece' ? 'pc' : 'ct'}
                </p>
                {r.changed_by_name && (
                  <p className="mt-1 text-xs text-muted">Last set by {r.changed_by_name}</p>
                )}
                <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                  <History className="h-3 w-3" />
                  {isSelected ? 'Hide history' : 'Click to view history'}
                </p>
              </div>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setOpen(true) }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted hover:text-[#b3261e]"
                  onClick={async () => {
                    if (!confirm(`Delete ${getStoneTypeLabel(r.stone_type) || r.stone_type} · ${r.grade} and all its price history?`)) return
                    try {
                      await removeStone.mutateAsync({
                        stone_type: r.stone_type,
                        grade: r.grade,
                        unit: r.unit,
                      })
                      if (selected && stoneKey(selected) === stoneKey(r)) setSelected(null)
                      toast.success('Stone deleted')
                    } catch (e) { toast.error(e.message) }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <div className="rounded-[28px] border border-gold/20 bg-ivory-3 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg text-navy">
              Rate history — {selectedLabel}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
          {selectedHistory.length ? (
            <StoneRateHistoryTable rows={selectedHistory} compact />
          ) : (
            <p className="text-sm text-muted">No history for this stone yet.</p>
          )}
        </div>
      )}

      <StoneRateFormDialog open={open} onOpenChange={setOpen} rate={editing} />
    </div>
  )
}
