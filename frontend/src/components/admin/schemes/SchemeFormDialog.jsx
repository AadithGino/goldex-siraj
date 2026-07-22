import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAdminSchemeMutations } from '@/hooks/useSchemes'
import { toFormState } from '@/lib/formUtils'
import { LocaleFieldTabs } from '@/components/admin/shared/LocaleFieldTabs'
import { SchemePayloadError, toSchemePayload } from '@/lib/schemePayload'

const DEFAULT = {
  name: '',
  name_ar: '',
  description: '',
  description_ar: '',
  tenure_months: 11,
  bonus_months: 0,
  monthly_amount: '',
  is_active: true,
}

function schemeToForm(scheme) {
  const base = toFormState(DEFAULT, scheme)
  if (!scheme?.id) return base
  return {
    ...base,
    monthly_amount: scheme.monthly_amount ?? '',
    tenure_months: scheme.tenure_months ?? 11,
    bonus_months: scheme.bonus_months ?? 0,
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
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit plan' : 'New plan'}</DialogTitle><DialogDescription>{isEdit ? 'Update gold scheme plan details.' : 'Create a gold savings scheme plan.'}</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <LocaleFieldTabs>
            {(locale) => (
              <>
                <Input
                  value={locale === 'en' ? form.name : form.name_ar || ''}
                  onChange={(e) => set(locale === 'en' ? 'name' : 'name_ar', e.target.value)}
                  placeholder={locale === 'en' ? 'Plan name *' : 'Arabic plan name'}
                  required={locale === 'en'}
                  dir={locale === 'ar' ? 'rtl' : undefined}
                  className={locale === 'ar' ? 'text-right' : undefined}
                />
                <textarea
                  value={locale === 'en' ? form.description || '' : form.description_ar || ''}
                  onChange={(e) => set(locale === 'en' ? 'description' : 'description_ar', e.target.value)}
                  rows={3}
                  dir={locale === 'ar' ? 'rtl' : undefined}
                  className={`w-full rounded-2xl border border-gold/20 bg-ivory-2 px-4 py-3 text-sm ${locale === 'ar' ? 'text-right' : ''}`}
                  placeholder={locale === 'en' ? 'Description' : 'Arabic description'}
                />
              </>
            )}
          </LocaleFieldTabs>
          <Input type="number" value={form.monthly_amount} onChange={(e) => set('monthly_amount', e.target.value)} placeholder="Monthly amount AED" required />
          <Input type="number" value={form.tenure_months} onChange={(e) => set('tenure_months', e.target.value)} placeholder="Tenure months" required />
          <div className="space-y-1">
            <Input
              type="number"
              min="0"
              max="24"
              step="1"
              value={form.bonus_months}
              onChange={(e) => set('bonus_months', e.target.value)}
              placeholder="Bonus months"
              required
            />
            <p className="text-xs text-muted">
              Example: 11 month plan with 1 bonus month = bonus months 1.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Active</label>
          <Button type="submit" className="w-full">Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
