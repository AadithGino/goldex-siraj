import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { STONE_SHAPES, SETTING_TYPES } from '@/lib/constants'
import { computeStoneLineCharge, formatStoneRateLabel, DEFAULT_PRODUCT_STONE } from '@/lib/stonePricing'
import { useStoneRates } from '@/hooks/useStoneRates'

function StoneRow({ stone, index, stoneRates, onChange, onRemove, canRemove }) {
  const selectedRate = stoneRates?.find((r) => r.id === stone.stone_rate_id)
  const mode = stone.pricing_mode === 'fixed' || (!stone.stone_rate_id && stone.manual_charge != null)
    ? 'fixed'
    : 'rate'
  const estimate = mode === 'rate' && selectedRate
    ? computeStoneLineCharge(selectedRate, stone)
    : Number(stone.manual_charge ?? stone.charge) || 0

  const handleRateChange = (rateId) => {
    if (!rateId || rateId === 'none') {
      onChange(index, {
        stone_rate_id: '',
        pricing_mode: 'fixed',
        stone_type: stone.stone_type || stone.label || '',
        grade: stone.grade || null,
        unit: stone.unit || 'piece',
        manual_charge: stone.manual_charge ?? estimate ?? 0,
      })
      return
    }
    const rate = stoneRates?.find((r) => r.id === rateId)
    if (!rate) return
    onChange(index, {
      stone_rate_id: rateId,
      pricing_mode: 'rate',
      stone_type: rate.stone_type,
      grade: rate.grade ?? null,
      unit: rate.unit === 'carat' ? 'carat' : 'piece',
      manual_charge: null,
    })
  }

  return (
    <div className="space-y-3 rounded-2xl border border-gold/20 bg-ivory-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-navy">Stone group {index + 1}</p>
        {canRemove && (
          <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)}>
            <Trash2 className="h-4 w-4 text-muted" />
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-medium text-navy">Label *</label>
          <Input
            value={stone.label || ''}
            onChange={(e) => onChange(index, { label: e.target.value })}
            placeholder="e.g. White Pearl HD"
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-medium text-navy">Pricing</label>
          <Select value={stone.stone_rate_id || 'none'} onValueChange={handleRateChange}>
            <SelectTrigger><SelectValue placeholder="Select rate" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Fixed / manual charge</SelectItem>
              {(stoneRates || []).map((rate) => (
                <SelectItem key={rate.id} value={rate.id}>
                  {formatStoneRateLabel(rate)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-navy">Count *</label>
          <Input
            type="number"
            min="1"
            value={stone.stone_count}
            onChange={(e) => onChange(index, { stone_count: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-navy">Shape</label>
          <Select value={stone.shape || 'Round'} onValueChange={(v) => onChange(index, { shape: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STONE_SHAPES.map((shape) => (
                <SelectItem key={shape} value={shape}>{shape}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-navy">Size (mm)</label>
          <Input
            type="number"
            step="0.01"
            value={stone.size_mm ?? ''}
            onChange={(e) => onChange(index, { size_mm: e.target.value })}
            placeholder="5.0"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-navy">Setting type</label>
          <Select
            value={stone.setting_type || 'Cap'}
            onValueChange={(v) => onChange(index, { setting_type: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SETTING_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(selectedRate?.unit === 'carat' || stone.unit === 'carat') && (
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Total carat weight *</label>
            <Input
              type="number"
              step="0.001"
              value={stone.stone_weight_carat ?? stone.weight ?? ''}
              onChange={(e) => onChange(index, { stone_weight_carat: e.target.value, weight: e.target.value })}
              required
            />
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-navy">
            {mode === 'rate' ? 'Estimated charge (AED)' : 'Manual charge (AED) *'}
          </label>
          <Input
            type="number"
            step="0.01"
            value={mode === 'rate' ? estimate : (stone.manual_charge ?? '')}
            readOnly={mode === 'rate'}
            onChange={(e) => {
              if (mode === 'fixed') onChange(index, { manual_charge: e.target.value, pricing_mode: 'fixed' })
            }}
            aria-readonly={mode === 'rate'}
          />
          <p className="mt-1 text-xs text-muted">
            {mode === 'rate'
              ? 'Estimate from current rate — checkout uses live server pricing'
              : 'Complete line charge (not multiplied again)'}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Multi-stone repeater for variant forms */
export function VariantStonesEditor({ stones = [], onChange }) {
  const { data: stoneRates, isLoading } = useStoneRates()

  const updateStone = (index, patch) => {
    onChange(stones.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  const addStone = () => {
    onChange([...stones, { ...DEFAULT_PRODUCT_STONE }])
  }

  const removeStone = (index) => {
    onChange(stones.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4 border-t border-gold/15 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[.12em] text-gold">Stone groups</p>
        <Link to="/admin/stone-rates" className="text-xs font-medium text-gold hover:underline">
          Manage stone rates →
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Loading stone rates…</p>
      ) : (
        <>
          {stones.length === 0 ? (
            <p className="text-sm text-muted">No stones yet. Add a rate-linked or fixed stone group.</p>
          ) : (
            stones.map((stone, index) => (
              <StoneRow
                key={stone.id || `stone-${index}`}
                stone={stone}
                index={index}
                stoneRates={stoneRates}
                onChange={updateStone}
                onRemove={removeStone}
                canRemove={stones.length > 0}
              />
            ))
          )}
          <Button type="button" variant="outline" size="sm" onClick={addStone}>
            <Plus className="h-4 w-4" />
            Add stone group
          </Button>
        </>
      )}
    </div>
  )
}

/**
 * Map API product_stones (or legacy metadata.stone_groups) into editor form rows.
 * Prefer aggregate stones; fall back to metadata only for compatibility.
 */
export function stonesFromVariant(variant) {
  const rows = variant?.product_stones || variant?.stones || []
  if (Array.isArray(rows) && rows.length) {
    return rows.map((s) => ({
      ...DEFAULT_PRODUCT_STONE,
      id: s.id,
      label: s.label || s.stone_type || '',
      stone_rate_id: s.stone_rate_id || '',
      pricing_mode: s.pricing_mode || (s.stone_rate_id ? 'rate' : 'fixed'),
      stone_type: s.stone_type || '',
      grade: s.grade ?? null,
      unit: s.unit === 'carat' ? 'carat' : 'piece',
      stone_count: s.stone_count ?? 1,
      shape: s.shape || 'Round',
      size_mm: s.size_mm ?? '',
      setting_type: s.setting_type || 'Cap',
      stone_weight_carat: s.weight ?? '',
      weight: s.weight ?? '',
      manual_charge: s.manual_charge ?? '',
    }))
  }
  const legacy = variant?.metadata?.stone_groups
  if (Array.isArray(legacy) && legacy.length) {
    return legacy.map((s) => ({ ...DEFAULT_PRODUCT_STONE, ...s }))
  }
  return []
}
