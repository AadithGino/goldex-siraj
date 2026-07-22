import { useMemo, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAdminStoneRates, useAdminStoneRateMutations } from '@/hooks/useAdminStoneRates'
import { STONE_TYPES, STONE_PURITIES } from '@/lib/constants'

const SELECTABLE_STONES = STONE_TYPES.filter((t) => t.value !== 'none')

const DEFAULT = {
  stone_type: 'diamond',
  stone_type_custom: '',
  grade: 'VVS',
  grade_custom: '',
  rate_per_unit: '',
  unit: 'carat',
}

function isKnownStoneType(value) {
  return SELECTABLE_STONES.some((t) => t.value === value && t.value !== 'other')
}

function isKnownGrade(value) {
  return STONE_PURITIES.some((p) => p.value === value && p.value !== 'other')
}

function rateToForm(rate) {
  if (!rate?.id) return { ...DEFAULT }

  const knownType = isKnownStoneType(rate.stone_type)
  const knownGrade = isKnownGrade(rate.grade)

  return {
    ...DEFAULT,
    stone_type: knownType ? rate.stone_type : 'other',
    stone_type_custom: knownType ? '' : rate.stone_type || '',
    grade: knownGrade ? rate.grade : 'other',
    grade_custom: knownGrade ? '' : rate.grade || '',
    rate_per_unit: rate.rate_per_unit ?? '',
    unit: rate.unit || 'carat',
  }
}

function resolveStoneType(form) {
  if (form.stone_type === 'other') {
    return (form.stone_type_custom || '').trim().toLowerCase().replace(/\s+/g, '_')
  }
  return form.stone_type
}

function resolveGrade(form) {
  if (form.grade === 'other') return (form.grade_custom || '').trim()
  return form.grade
}

export function StoneRateFormDialog({ open, onOpenChange, rate }) {
  const { data: allRates } = useAdminStoneRates()
  const { saveStone } = useAdminStoneRateMutations()
  const [form, setForm] = useState(rateToForm(rate))
  const isEdit = !!rate?.id
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    if (open) setForm(rateToForm(rate))
  }, [open, rate])

  const extraStoneTypes = useMemo(() => {
    const known = new Set(SELECTABLE_STONES.map((t) => t.value))
    const fromDb = [...new Set((allRates || []).map((r) => r.stone_type).filter(Boolean))]
    return fromDb.filter((t) => !known.has(t))
  }, [allRates])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const stone_type = resolveStoneType(form)
    const grade = resolveGrade(form)

    if (!stone_type) {
      toast.error('Enter a stone type')
      return
    }
    if (!grade) {
      toast.error('Enter a grade / purity')
      return
    }

    try {
      await saveStone.mutateAsync({
        stone_type,
        grade,
        rate_per_unit: Number(form.rate_per_unit),
        unit: form.unit,
      })
      toast.success(isEdit ? 'Stone updated' : 'Stone added')
      onOpenChange(false)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit stone' : 'Add stone'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update stone rate details.' : 'Add a stone rate used in live pricing.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Stone type</label>
            <Select value={form.stone_type} onValueChange={(v) => set('stone_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SELECTABLE_STONES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
                {extraStoneTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.stone_type === 'other' && (
              <Input
                className="mt-2"
                value={form.stone_type_custom}
                onChange={(e) => set('stone_type_custom', e.target.value)}
                placeholder="e.g. alexandrite, tanzanite"
                required
              />
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Grade / purity</label>
            <Select value={form.grade} onValueChange={(v) => set('grade', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STONE_PURITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.grade === 'other' && (
              <Input
                className="mt-2"
                value={form.grade_custom}
                onChange={(e) => set('grade_custom', e.target.value)}
                placeholder="Custom grade"
                required
              />
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Pricing unit</label>
            <Select value={form.unit} onValueChange={(v) => set('unit', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="carat">Per carat</SelectItem>
                <SelectItem value="piece">Per piece</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Rate (AED)</label>
            <Input
              type="number"
              value={form.rate_per_unit}
              onChange={(e) => set('rate_per_unit', e.target.value)}
              placeholder="Rate per unit"
              required
            />
            {isEdit && (
              <p className="mt-1 text-xs text-muted">
                Changing the rate archives the previous price in history.
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={saveStone.isPending}>
            {isEdit ? 'Save stone' : 'Add stone'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
