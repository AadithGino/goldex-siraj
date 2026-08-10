import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LabeledSelect } from '@/components/ui/labeled-select'
import { useAdminSchemeMutations } from '@/hooks/useSchemes'
import { toFormState } from '@/lib/formUtils'
import { LocaleFieldTabs } from '@/components/admin/shared/LocaleFieldTabs'
import { SchemePayloadError, toSchemePayload } from '@/lib/schemePayload'

const DEFAULT = {
  name: '',
  name_ar: '',
  description: '',
  description_ar: '',
  tenure_months: 12,
  bonus_months: 0,
  benefit_type: 'bonus_months',
  benefit_fixed_amount: '',
  monthly_amount: '',
  is_active: true,
}

const TENURE_OPTIONS = [
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
]

const BENEFIT_TYPE_OPTIONS = [
  { value: 'bonus_months', label: 'Bonus months' },
  { value: 'fixed_amount', label: 'Fixed amount (AED)' },
]

function schemeToForm(scheme) {
  const base = toFormState(DEFAULT, scheme)
  if (!scheme?.id) return base
  return {
    ...base,
    monthly_amount: scheme.monthly_amount ?? '',
    tenure_months: scheme.tenure_months ?? 12,
    bonus_months: scheme.bonus_months ?? 0,
    benefit_type: scheme.benefit_type || 'bonus_months',
    benefit_fixed_amount: scheme.benefit_fixed_amount ?? '',
  }
}

export function SchemeFormDialog({ open, onOpenChange, scheme }) {
  const { create, update } = useAdminSchemeMutations()
  const [form, setForm] = useState(schemeToForm(scheme))
  const isEdit = !!scheme?.id
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    if (open) setForm(schemeToForm(scheme))
  }, [open, scheme])

  const handleSubmit = async (e) => {
    e.preventDefault()
    let payload
    try {
      payload = toSchemePayload(form)
    } catch (err) {
      toast.error(err instanceof SchemePayloadError ? err.message : 'Invalid scheme values')
      return
    }
    try {
      if (isEdit) await update.mutateAsync({ id: scheme.id, ...payload })
      else await create.mutateAsync(payload)
      toast.success('Saved')
      onOpenChange(false)
    } catch (err) { toast.error(err.message) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit plan' : 'New plan'}</DialogTitle><DialogDescription>{isEdit ? 'Update gold scheme plan details.' : 'Create a gold savings scheme plan.'}</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <LocaleFieldTabs>
            {(locale) => (
              <>
                <Input
                  value={locale === 'en' ? form.name : form.name_ar || ''}
                  onChange={(e) => set(locale === 'en' ? 'name' : 'name_ar', e.target.value)}
                  placeholder={locale === 'en' ? 'Plan name *' : 'Arabic plan name'}
                  required={locale === 'en'}
                  dir={locale === 'ar' ? 'rtl' : undefined}
                  className={locale === 'ar' ? 'text-right rounded-2xl' : 'rounded-2xl'}
                />
                <textarea
                  value={locale === 'en' ? form.description || '' : form.description_ar || ''}
                  onChange={(e) => set(locale === 'en' ? 'description' : 'description_ar', e.target.value)}
                  rows={3}
                  dir={locale === 'ar' ? 'rtl' : undefined}
                  className={`w-full rounded-2xl border border-gold/20 bg-ivory-2 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30 ${locale === 'ar' ? 'text-right' : ''}`}
                  placeholder={locale === 'en' ? 'Description' : 'Arabic description'}
                />
              </>
            )}
          </LocaleFieldTabs>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-navy">Monthly amount (AED)</label>
            <Input
              type="number"
              value={form.monthly_amount}
              onChange={(e) => set('monthly_amount', e.target.value)}
              placeholder="e.g. 500"
              required
              className="rounded-2xl"
            />
          </div>

          <LabeledSelect
            label="Duration"
            value={String(form.tenure_months)}
            onValueChange={(v) => set('tenure_months', Number(v))}
            options={TENURE_OPTIONS}
            placeholder="Choose duration"
          />

          <LabeledSelect
            label="Benefit type"
            value={form.benefit_type}
            onValueChange={(v) => set('benefit_type', v)}
            options={BENEFIT_TYPE_OPTIONS}
            placeholder="Choose benefit"
          />

          {form.benefit_type === 'bonus_months' ? (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-navy">Bonus months</label>
              <Input
                type="number"
                min="0"
                max="24"
                step="1"
                value={form.bonus_months}
                onChange={(e) => set('bonus_months', e.target.value)}
                placeholder="e.g. 1"
                required
                className="rounded-2xl"
              />
              <p className="text-xs leading-relaxed text-muted">
                Example: 12 month plan with 1 bonus month = customer receives 13 months&apos; worth at payout.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-navy">Fixed benefit (AED)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.benefit_fixed_amount}
                onChange={(e) => set('benefit_fixed_amount', e.target.value)}
                placeholder="e.g. 500"
                required
                className="rounded-2xl"
              />
            </div>
          )}

          <label className="flex items-center gap-2.5 rounded-2xl border border-gold/20 bg-ivory-2 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => set('is_active', e.target.checked)}
              className="h-4 w-4 rounded border-gold/40 text-gold focus:ring-gold/30"
            />
            <span className="font-medium text-navy">Active plan</span>
          </label>

          <Button type="submit" className="w-full">Save plan</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
