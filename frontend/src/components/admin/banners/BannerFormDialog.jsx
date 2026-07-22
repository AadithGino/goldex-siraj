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
import { BannerImageField } from '@/components/admin/banners/BannerImageField'
import { useAdminBannerMutations } from '@/hooks/useAdminBanners'
import { getBannerSpec, BANNER_SPECS, BANNER_POSITIONS, formatBannerSize } from '@/lib/bannerSpecs'
import { BannerPayloadError, bannerDateToInput, toBannerPayload } from '@/lib/bannerPayload'
import { toFormState } from '@/lib/formUtils'
import { LocaleSection } from '@/components/admin/shared/LocaleFieldTabs'

const DEFAULT = {
  position: 'hero',
  title: '',
  title_ar: '',
  image_url: '',
  mobile_image_url: '',
  image_url_ar: '',
  mobile_image_url_ar: '',
  cta_link: '',
  display_order: 0,
  is_active: true,
  starts_at: '',
  ends_at: '',
}

const POSITIONS = BANNER_POSITIONS

function bannerToForm(banner) {
  const base = toFormState(DEFAULT, banner)
  return {
    ...base,
    starts_at: bannerDateToInput(banner?.starts_at),
    ends_at: bannerDateToInput(banner?.ends_at),
    display_order: banner?.display_order ?? 0,
  }
}

export function BannerFormDialog({ open, onOpenChange, banner }) {
  const { create, update } = useAdminBannerMutations()
  const [form, setForm] = useState(bannerToForm(banner))
  const isEdit = !!banner?.id
  const spec = getBannerSpec(form.position)

  useEffect(() => {
    if (open) setForm(bannerToForm(banner))
  }, [open, banner])

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()

    let payload
    try {
      payload = toBannerPayload({
        position: form.position,
        title: form.title,
        title_ar: form.title_ar,
        subtitle: null,
        eyebrow: null,
        image_url: form.image_url,
        mobile_image_url: form.mobile_image_url,
        image_url_ar: form.image_url_ar,
        mobile_image_url_ar: form.mobile_image_url_ar,
        cta_text: null,
        cta_link: form.cta_link,
        display_order: form.display_order,
        is_active: form.is_active,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
      })
    } catch (err) {
      toast.error(err instanceof BannerPayloadError ? err.message : 'Invalid banner form')
      return
    }

    try {
      if (isEdit) {
        await update.mutateAsync({ id: banner.id, ...payload })
        toast.success('Banner updated')
      } else {
        await create.mutateAsync(payload)
        toast.success('Banner created')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err.message || 'Save failed')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit banner' : 'New banner'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update homepage banner content.' : 'Create a storefront banner.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <p className="rounded-xl bg-ivory-3 px-3 py-2 text-xs leading-relaxed text-muted">
            Upload horizontal banner images only. Mobile banners are also wide images optimized
            for phone screens — do not upload 9:16 poster creatives.
          </p>

          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Position</label>
            <Select value={form.position} onValueChange={(v) => updateField('position', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {POSITIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {BANNER_SPECS[p]?.label || p.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted">
              {spec.label} · Desktop {formatBannerSize(spec.desktop)} · Mobile {formatBannerSize(spec.mobile)}
            </p>
            <p className="mt-1 text-xs text-muted">
              Mobile banners are horizontal and cropped safely inside the home page. Use the
              recommended size for best results.
            </p>
          </div>

          <LocaleSection title="English creative">
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Admin label *</label>
              <Input
                value={form.title || ''}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="e.g. Eid hero EN — for your reference only"
                required
              />
            </div>
            <BannerImageField
              label="Desktop image *"
              spec={spec.desktop}
              aspectClass={spec.desktopAspect}
              value={form.image_url}
              onChange={(url) => updateField('image_url', url)}
              uploadFolder={`${form.position}/desktop/en`}
            />
            <BannerImageField
              label="Mobile wide image *"
              spec={spec.mobile}
              aspectClass={spec.mobileAspect}
              value={form.mobile_image_url}
              onChange={(url) => updateField('mobile_image_url', url)}
              uploadFolder={`${form.position}/mobile/en`}
            />
          </LocaleSection>

          <LocaleSection title="Arabic creative (optional)">
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Admin label (Arabic)</label>
              <Input
                value={form.title_ar || ''}
                onChange={(e) => updateField('title_ar', e.target.value)}
                placeholder="مثال: بانر العيد"
                dir="rtl"
                className="text-right"
              />
            </div>
            <BannerImageField
              label="Desktop image (Arabic)"
              spec={spec.desktop}
              aspectClass={spec.desktopAspect}
              value={form.image_url_ar}
              onChange={(url) => updateField('image_url_ar', url)}
              uploadFolder={`${form.position}/desktop/ar`}
            />
            <BannerImageField
              label="Mobile wide image (Arabic)"
              spec={spec.mobile}
              aspectClass={spec.mobileAspect}
              value={form.mobile_image_url_ar}
              onChange={(url) => updateField('mobile_image_url_ar', url)}
              uploadFolder={`${form.position}/mobile/ar`}
            />
          </LocaleSection>

          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Link URL (optional)</label>
            <Input
              value={form.cta_link || ''}
              onChange={(e) => updateField('cta_link', e.target.value)}
              placeholder="/search or /category/rings"
            />
            <p className="mt-1 text-xs text-muted">Whole banner becomes clickable when set. Shared for both languages.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Starts on</label>
              <Input type="date" value={form.starts_at} onChange={(e) => updateField('starts_at', e.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Ends on</label>
              <Input type="date" value={form.ends_at} onChange={(e) => updateField('ends_at', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Display order</label>
            <Input
              type="number"
              value={form.display_order}
              onChange={(e) => updateField('display_order', e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.is_active}
              onChange={(e) => updateField('is_active', e.target.checked)}
            />
            Active
          </label>

          <Button type="submit" className="w-full" disabled={create.isPending || update.isPending}>
            {isEdit ? 'Save banner' : 'Create banner'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
