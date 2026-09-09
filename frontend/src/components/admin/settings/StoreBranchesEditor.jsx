import { MapPin, Plus, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LabeledSelect } from '@/components/ui/labeled-select'
import { LocaleFieldTabs } from '@/components/admin/shared/LocaleFieldTabs'
import { getUaeEmirates } from '@/lib/i18nLabels'
import { emptyStoreBranch } from '@/lib/storeBranches'

export function StoreBranchesEditor({ value = [], onChange }) {
  const branches = Array.isArray(value) ? value : []
  const emirates = getUaeEmirates()

  const update = (index, patch) => {
    onChange(branches.map((branch, i) => (i === index ? { ...branch, ...patch } : branch)))
  }

  const setPrimary = (index) => {
    onChange(branches.map((branch, i) => ({ ...branch, is_primary: i === index })))
  }

  const addBranch = () => {
    onChange([
      ...branches,
      emptyStoreBranch({ is_primary: branches.length === 0 }),
    ])
  }

  const removeBranch = (index) => {
    const next = branches.filter((_, i) => i !== index)
    if (next.length && !next.some((branch) => branch.is_primary)) {
      next[0] = { ...next[0], is_primary: true }
    }
    onChange(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-navy">Branch addresses</p>
          <p className="mt-1 text-xs text-muted">
            These branches appear in the storefront footer. Mark one as the flagship for invoices.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addBranch}>
          <Plus className="h-4 w-4" />
          Add branch
        </Button>
      </div>

      {branches.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gold/30 bg-ivory px-4 py-8 text-center">
          <MapPin className="mx-auto h-6 w-6 text-gold/50" />
          <p className="mt-2 text-sm text-muted">No branches yet. Add your showrooms to show them in the footer.</p>
        </div>
      )}

      {branches.map((branch, index) => (
        <div key={branch._key || branch.id || index} className="space-y-3 rounded-2xl border border-gold/20 bg-ivory p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-navy">
              {branch.name?.trim() || `Branch ${index + 1}`}
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant={branch.is_primary ? 'navy' : 'ghost'}
                size="sm"
                onClick={() => setPrimary(index)}
              >
                <Star className={`h-3.5 w-3.5 ${branch.is_primary ? 'fill-current' : ''}`} />
                {branch.is_primary ? 'Flagship' : 'Set flagship'}
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeBranch(index)} aria-label="Remove branch">
                <Trash2 className="h-4 w-4 text-muted" />
              </Button>
            </div>
          </div>

          <LocaleFieldTabs>
            {(locale) => (
              <div className="space-y-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-navy">
                    {locale === 'en' ? 'Branch name' : 'اسم الفرع'}
                  </label>
                  <Input
                    value={locale === 'en' ? branch.name : branch.name_ar || ''}
                    onChange={(e) => update(index, locale === 'en' ? { name: e.target.value } : { name_ar: e.target.value })}
                    placeholder={locale === 'en' ? 'e.g. Dubai Mall' : 'مثال: دبي مول'}
                    required={locale === 'en'}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-navy">
                    {locale === 'en' ? 'Opening hours' : 'ساعات العمل'}
                  </label>
                  <Input
                    value={locale === 'en' ? branch.hours : branch.hours_ar || ''}
                    onChange={(e) => update(index, locale === 'en' ? { hours: e.target.value } : { hours_ar: e.target.value })}
                    placeholder={locale === 'en' ? 'e.g. 10:00 AM – 10:00 PM · Daily' : 'مثال: ١٠ صباحاً – ١٠ مساءً · يومياً'}
                  />
                </div>
              </div>
            )}
          </LocaleFieldTabs>

          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Address line 1</label>
            <Input
              value={branch.line1 || ''}
              onChange={(e) => update(index, { line1: e.target.value })}
              placeholder="Mall, street, or building"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Address line 2</label>
            <Input
              value={branch.line2 || ''}
              onChange={(e) => update(index, { line2: e.target.value })}
              placeholder="Unit, floor, or landmark (optional)"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">City / area</label>
              <Input
                value={branch.city || ''}
                onChange={(e) => update(index, { city: e.target.value })}
                placeholder="Downtown, Marina…"
              />
            </div>
            <LabeledSelect
              label="Emirate"
              value={branch.emirate || ''}
              onValueChange={(emirate) => update(index, { emirate })}
              options={emirates}
              placeholder="Select emirate"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Branch phone</label>
              <Input
                value={branch.phone || ''}
                onChange={(e) => update(index, { phone: e.target.value })}
                placeholder="+971 4 …"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Google Maps URL</label>
              <Input
                value={branch.maps_url || ''}
                onChange={(e) => update(index, { maps_url: e.target.value })}
                placeholder="https://maps.google.com/…"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
