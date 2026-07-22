import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAdminProductMutations } from '@/hooks/useAdminProducts'
import { slugify } from '@/lib/storage'
import { PURITIES, OCCASIONS, GENDERS, METAL_COLORS } from '@/lib/constants'
import { DEFAULT_PRODUCT, toProductPayload, productToFormState } from '@/lib/productDefaults'
import { LocaleFieldTabs } from '@/components/admin/shared/LocaleFieldTabs'
import { TaxTreatmentField } from '@/components/admin/products/TaxTreatmentField'

export function ProductFormDialog({ open, onOpenChange, product, categories, brands = [], onCreated }) {
  const { createProduct, updateProduct } = useAdminProductMutations()
  const [form, setForm] = useState({ ...DEFAULT_PRODUCT })
  const isEdit = !!product?.id

  useEffect(() => {
    if (open) {
      setForm(productToFormState(product))
    }
  }, [open, product])

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleNameChange = (name) => {
    update('name', name)
    if (!isEdit) update('slug', slugify(name))
  }

  const toggleOccasion = (key) => {
    const current = form.occasion || []
    update(
      'occasion',
      current.includes(key) ? current.filter((o) => o !== key) : [...current, key]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const wastage = Number(form.wastage_percent)
    if (!Number.isFinite(wastage) || wastage < 0) {
      toast.error('Wastage % must be zero or greater')
      return
    }
    const payload = toProductPayload(form)

    try {
      if (isEdit) {
        await updateProduct.mutateAsync({ id: product.id, ...payload })
        toast.success('Product updated')
      } else {
        const created = await createProduct.mutateAsync(payload)
        toast.success('Product created — add variants and images next')
        onCreated?.(created)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err.message || 'Save failed')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit product' : 'New product'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update product details.' : 'Create a new catalog product.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <LocaleFieldTabs>
            {(locale) => (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-navy">
                    Name {locale === 'en' ? '*' : '(Arabic)'}
                  </label>
                  {locale === 'en' ? (
                    <Input value={form.name} onChange={(e) => handleNameChange(e.target.value)} required />
                  ) : (
                    <Input
                      value={form.name_ar || ''}
                      onChange={(e) => update('name_ar', e.target.value)}
                      dir="rtl"
                      className="text-right"
                    />
                  )}
                </div>
                {locale === 'en' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-navy">Slug</label>
                    <Input value={form.slug} onChange={(e) => update('slug', e.target.value)} required />
                  </div>
                )}
                <div>
                  <label className="mb-2 block text-sm font-medium text-navy">Short description</label>
                  {locale === 'en' ? (
                    <Input value={form.short_desc || ''} onChange={(e) => update('short_desc', e.target.value)} />
                  ) : (
                    <Input
                      value={form.short_desc_ar || ''}
                      onChange={(e) => update('short_desc_ar', e.target.value)}
                      dir="rtl"
                      className="text-right"
                    />
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-navy">Description</label>
                  {locale === 'en' ? (
                    <textarea
                      value={form.description || ''}
                      onChange={(e) => update('description', e.target.value)}
                      rows={4}
                      className="w-full rounded-2xl border border-gold/20 bg-ivory-2 px-4 py-3 text-sm"
                    />
                  ) : (
                    <textarea
                      value={form.description_ar || ''}
                      onChange={(e) => update('description_ar', e.target.value)}
                      rows={4}
                      dir="rtl"
                      className="w-full rounded-2xl border border-gold/20 bg-ivory-2 px-4 py-3 text-sm text-right"
                    />
                  )}
                </div>
              </>
            )}
          </LocaleFieldTabs>
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Category</label>
            <Select value={form.category_id || ''} onValueChange={(v) => update('category_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Brand</label>
            <Select value={form.brand_id || ''} onValueChange={(v) => update('brand_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Purity</label>
              <Select value={form.purity} onValueChange={(v) => update('purity', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PURITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Status</label>
              <Select value={form.status} onValueChange={(v) => update('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['draft', 'active', 'archived'].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Metal color</label>
            <Select value={form.metal_color || 'yellow'} onValueChange={(v) => update('metal_color', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METAL_COLORS.map((color) => (
                  <SelectItem key={color.value} value={color.value}>{color.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Gender / audience</label>
            <Select value={form.gender || 'unisex'} onValueChange={(v) => update('gender', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Making charge type</label>
              <Select value={form.making_charge_type} onValueChange={(v) => update('making_charge_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent of gold value</SelectItem>
                  <SelectItem value="flat">Flat AED amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">
                Making charge {form.making_charge_type === 'percent' ? '(%)' : '(AED)'}
              </label>
              <Input
                type="number"
                value={form.making_charge_value}
                onChange={(e) => update('making_charge_value', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Wastage %</label>
            <Input
              type="number"
              step="0.01"
              value={form.wastage_percent}
              onChange={(e) => update('wastage_percent', e.target.value)}
            />
          </div>
          <TaxTreatmentField
            value={form.tax_treatment || 'standard'}
            onChange={(v) => update('tax_treatment', v)}
            purity={form.purity}
          />
          <div>
            <p className="mb-2 text-sm font-medium text-navy">Occasions</p>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleOccasion(key)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    form.occasion?.includes(key)
                      ? 'border-navy bg-navy text-gold-3'
                      : 'border-gold/30 text-navy'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(e) => update('is_featured', e.target.checked)}
              />
              Featured
            </label>
          </div>
          <p className="text-xs text-muted">Add product certificates from the product Certificates tab.</p>
          <Button type="submit" className="w-full">
            {isEdit ? 'Save changes' : 'Create product'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
