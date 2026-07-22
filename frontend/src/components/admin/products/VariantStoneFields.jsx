import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { computeStoneCharge, formatStoneRateLabel } from '@/lib/stonePricing'
import { useStoneRates } from '@/hooks/useStoneRates'

/**
 * Stone picker linked to admin stone rate card — auto-calculates stone_charge.
 */
export function VariantStoneFields({ form, onPatch }) {
  const { data: stoneRates, isLoading } = useStoneRates()
  const selectedRate = stoneRates?.find((r) => r.id === form.stone_rate_id)
  const hasStone = !!form.stone_rate_id

  useEffect(() => {
    if (!hasStone || !selectedRate) return
    const charge = computeStoneCharge(selectedRate, form.stone_weight_carat)
    if (Number(form.stone_charge) !== charge) {
      onPatch({ stone_charge: charge })
    }
  }, [hasStone, selectedRate, form.stone_weight_carat, form.stone_charge])

  const handleStoneRateChange = (rateId) => {
    if (!rateId || rateId === 'none') {
      onPatch({
        stone_rate_id: '',
        stone_type: 'none',
        stone_purity: '',
        stone_weight_carat: '',
        stone_charge: 0,
      })
      return
    }
    const rate = stoneRates?.find((r) => r.id === rateId)
    if (!rate) return
    onPatch({
      stone_rate_id: rateId,
      stone_type: rate.stone_type,
      stone_purity: rate.grade,
      stone_charge: computeStoneCharge(rate, form.stone_weight_carat),
    })
  }

  return (
    <div className="space-y-4 border-t border-gold/15 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[.12em] text-gold">Stone (from rate card)</p>
        <Link to="/admin/stone-rates" className="text-xs font-medium text-gold hover:underline">
          Manage stone rates →
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Loading stone rates…</p>
      ) : !stoneRates?.length ? (
        <p className="text-sm text-muted">
          No stone rates yet.{' '}
          <Link to="/admin/stone-rates" className="font-medium text-gold hover:underline">
            Add rates in Admin → Stone rates
          </Link>{' '}
          first, then pick one here.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-navy">Stone rate</label>
            <Select value={form.stone_rate_id || 'none'} onValueChange={handleStoneRateChange}>
              <SelectTrigger><SelectValue placeholder="Select stone rate" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No stone</SelectItem>
                {stoneRates.map((rate) => (
                  <SelectItem key={rate.id} value={rate.id}>
                    {formatStoneRateLabel(rate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasStone && selectedRate && (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-navy">Stone type</label>
                <Input value={selectedRate.stone_type} disabled className="capitalize bg-ivory-3" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-navy">Purity / grade</label>
                <Input value={selectedRate.grade} disabled className="bg-ivory-3" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-navy">
                  Stone weight ({selectedRate.unit === 'piece' ? 'pieces' : 'carat'}) *
                </label>
                <Input
                  type="number"
                  step="0.001"
                  value={form.stone_weight_carat ?? ''}
                  onChange={(e) => onPatch({ stone_weight_carat: e.target.value })}
                  required={selectedRate.unit === 'carat'}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-navy">Stone charge (AED)</label>
                <Input
                  type="number"
                  value={form.stone_charge ?? 0}
                  onChange={(e) => onPatch({ stone_charge: e.target.value })}
                />
                <p className="mt-1 text-xs text-muted">
                  Auto-calculated from rate card — editable if needed
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
