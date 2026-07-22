import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAdminCmsMutations } from '@/hooks/useCmsPages'
import { CmsPayloadError, toCmsPayload } from '@/lib/cmsPayload'
import { slugify } from '@/lib/storage'
import { toFormState } from '@/lib/formUtils'
import { LocaleFieldTabs } from '@/components/admin/shared/LocaleFieldTabs'

const DEFAULT = {
  title: '',
  title_ar: '',
  slug: '',
  content: '',
  content_ar: '',
  is_published: false,
}

export function CmsFormDialog({ open, onOpenChange, page }) {
  const { create, update } = useAdminCmsMutations()
  const [form, setForm] = useState(toFormState(DEFAULT, page))
  const isEdit = !!page?.id
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    if (open) setForm(toFormState(DEFAULT, page))
  }, [open, page])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = toCmsPayload(form, { partial: isEdit })
      if (isEdit) await update.mutateAsync({ id: page.id, ...payload })
      else await create.mutateAsync(payload)
      toast.success('Saved')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof CmsPayloadError ? err.message : err.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit page' : 'New page'}</DialogTitle><DialogDescription>{isEdit ? 'Update CMS page content.' : 'Create a new storefront CMS page.'}</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <LocaleFieldTabs>
            {(locale) => (
              <>
                <Input
                  value={locale === 'en' ? form.title : form.title_ar || ''}
                  onChange={(e) => {
                    if (locale === 'en') {
                      set('title', e.target.value)
                      if (!isEdit) set('slug', slugify(e.target.value))
                    } else {
                      set('title_ar', e.target.value)
                    }
                  }}
                  placeholder={locale === 'en' ? 'Title *' : 'Arabic title'}
                  required={locale === 'en'}
                  dir={locale === 'ar' ? 'rtl' : undefined}
                  className={locale === 'ar' ? 'text-right' : undefined}
                />
                {locale === 'en' && (
                  <Input value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="slug" required />
                )}
                <textarea
                  value={locale === 'en' ? form.content : form.content_ar || ''}
                  onChange={(e) => (locale === 'en' ? set('content', e.target.value) : set('content_ar', e.target.value))}
                  rows={10}
                  required={locale === 'en'}
                  dir={locale === 'ar' ? 'rtl' : undefined}
                  className={`w-full rounded-2xl border border-gold/20 bg-ivory-2 px-4 py-3 text-sm ${locale === 'ar' ? 'text-right' : ''}`}
                  placeholder={locale === 'en' ? 'HTML or plain text content' : 'Arabic content'}
                />
              </>
            )}
          </LocaleFieldTabs>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_published} onChange={(e) => set('is_published', e.target.checked)} />
            Published
          </label>
          <Button type="submit" className="w-full">Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
