import { useEffect, useState } from 'react'
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
import { slugify } from '@/lib/storage'
import { useAdminBrandMutations } from '@/hooks/useAdminBrands'
import { LocaleFieldTabs } from '@/components/admin/shared/LocaleFieldTabs'
import { BrandImageUploadField } from '@/components/admin/brands/BrandImageUploadField'
import { toBrandPayload } from '@/lib/catalogPayloads'

const DEFAULT = {
  name: '',
  name_ar: '',
  slug: '',
  description: '',
  description_ar: '',
  logo_desktop_url: '',
  logo_tablet_url: '',
  logo_mobile_url: '',
  banner_desktop_url: '',
  banner_tablet_url: '',
  banner_mobile_url: '',
  display_order: 0,
  is_active: true,
}

export function BrandFormDialog({ open, onOpenChange, brand }) {
  const { create, update } = useAdminBrandMutations()
  const [form, setForm] = useState(DEFAULT)
  const isEdit = !!brand?.id

  useEffect(() => {
    if (!open) return
    setForm({
      ...DEFAULT,
      name: brand?.name || '',
      name_ar: brand?.name_ar || '',
      slug: brand?.slug || '',
      description: brand?.description || '',
      description_ar: brand?.description_ar || '',
      logo_desktop_url: brand?.logo_desktop_url || '',
      logo_tablet_url: brand?.logo_tablet_url || '',
      logo_mobile_url: brand?.logo_mobile_url || '',
      banner_desktop_url: brand?.banner_desktop_url || '',
      banner_tablet_url: brand?.banner_tablet_url || '',
      banner_mobile_url: brand?.banner_mobile_url || '',
      display_order: brand?.display_order ?? 0,
      is_active: brand?.is_active ?? true,
    })
  }, [open, brand])

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleNameChange = (name) => {
    updateField('name', name)
    if (!isEdit) updateField('slug', slugify(name))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name?.trim()) {
      toast.error('Brand name is required')
      return
    }
    if (!form.slug?.trim()) {
      toast.error('Brand slug is required')
      return
    }

    const payload = toBrandPayload({
      ...form,
      name: form.name.trim(),
      slug: slugify(form.slug),
      display_order: Number(form.display_order) || 0,
    })

    try {
      if (isEdit) {
        await update.mutateAsync({ id: brand.id, ...payload })
        toast.success('Brand updated')
      } else {
        await create.mutateAsync(payload)
        toast.success('Brand created')
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(error.message || 'Save failed')
    }
  }

  const uploadFolder = `brands/${form.slug || 'draft'}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit brand' : 'New brand'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update brand details.' : 'Add a new brand to the catalog.'}</DialogDescription>
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
                      onChange={(e) => updateField('name_ar', e.target.value)}
                      dir="rtl"
                      className="text-right"
                    />
                  )}
                </div>
                {locale === 'en' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-navy">Slug</label>
                    <Input value={form.slug} onChange={(e) => updateField('slug', e.target.value)} required />
                  </div>
                )}
                <div>
                  <label className="mb-2 block text-sm font-medium text-navy">Description</label>
                  {locale === 'en' ? (
                    <textarea
                      value={form.description || ''}
                      onChange={(e) => updateField('description', e.target.value)}
                      rows={3}
                      className="w-full rounded-2xl border border-gold/20 bg-ivory-2 px-4 py-3 text-sm"
                    />
                  ) : (
                    <textarea
                      value={form.description_ar || ''}
                      onChange={(e) => updateField('description_ar', e.target.value)}
                      rows={3}
                      dir="rtl"
                      className="w-full rounded-2xl border border-gold/20 bg-ivory-2 px-4 py-3 text-sm text-right"
                    />
                  )}
                </div>
              </>
            )}
          </LocaleFieldTabs>

          <div className="grid gap-3 sm:grid-cols-3">
            <BrandImageUploadField
              label="Logo - desktop"
              value={form.logo_desktop_url}
              onChange={(v) => updateField('logo_desktop_url', v)}
              uploadFolder={uploadFolder}
              aspectClass="aspect-[8/3]"
            />
            <BrandImageUploadField
              label="Logo - tablet"
              value={form.logo_tablet_url}
              onChange={(v) => updateField('logo_tablet_url', v)}
              uploadFolder={uploadFolder}
              aspectClass="aspect-[6/3]"
            />
            <BrandImageUploadField
              label="Logo - mobile"
              value={form.logo_mobile_url}
              onChange={(v) => updateField('logo_mobile_url', v)}
              uploadFolder={uploadFolder}
              aspectClass="aspect-[4/3]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <BrandImageUploadField
              label="Banner - desktop"
              value={form.banner_desktop_url}
              onChange={(v) => updateField('banner_desktop_url', v)}
              uploadFolder={uploadFolder}
              aspectClass="aspect-[24/9]"
            />
            <BrandImageUploadField
              label="Banner - tablet"
              value={form.banner_tablet_url}
              onChange={(v) => updateField('banner_tablet_url', v)}
              uploadFolder={uploadFolder}
              aspectClass="aspect-[16/7]"
            />
            <BrandImageUploadField
              label="Banner - mobile"
              value={form.banner_mobile_url}
              onChange={(v) => updateField('banner_mobile_url', v)}
              uploadFolder={uploadFolder}
              aspectClass="aspect-[16/9]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Display order</label>
              <Input
                type="number"
                value={form.display_order}
                onChange={(e) => updateField('display_order', e.target.value)}
              />
            </div>
            <label className="mt-8 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.is_active}
                onChange={(e) => updateField('is_active', e.target.checked)}
              />
              Active
            </label>
          </div>

          <Button type="submit" className="w-full">
            {isEdit ? 'Save brand' : 'Create brand'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
