import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Upload, X } from 'lucide-react'
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
import { useAdminCategoryMutations } from '@/hooks/useAdminCategories'
import { slugify, uploadCategoryImage } from '@/lib/storage'
import { toFormState } from '@/lib/formUtils'
import { toCategoryPayload } from '@/lib/catalogPayloads'
import { LocaleFieldTabs } from '@/components/admin/shared/LocaleFieldTabs'

const DEFAULT = {
  name: '',
  name_ar: '',
  slug: '',
  parent_id: '',
  image_url: '',
  description: '',
  description_ar: '',
  display_order: 0,
  is_active: true,
}

function categoryToForm(category) {
  const base = toFormState(DEFAULT, category)
  return {
    ...base,
    parent_id: category?.parent_id || '',
    display_order: category?.display_order ?? 0,
  }
}

export function CategoryFormDialog({ open, onOpenChange, category, categories }) {
  const { create, update } = useAdminCategoryMutations()
  const [form, setForm] = useState(categoryToForm(category))
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const isEdit = !!category?.id

  useEffect(() => {
    if (open) {
      setForm(categoryToForm(category))
      setImageFile(null)
      setImagePreview(null)
    }
  }, [open, category])

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleNameChange = (name) => {
    updateField('name', name)
    if (!isEdit) updateField('slug', slugify(name))
  }

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    updateField('image_url', '')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    let imageUrl = form.image_url || ''

    if (imageFile) {
      setUploading(true)
      try {
        imageUrl = await uploadCategoryImage(imageFile, form.slug || 'category')
      } catch (err) {
        toast.error('Image upload failed: ' + err.message)
        setUploading(false)
        return
      }
      setUploading(false)
    }

    const payload = toCategoryPayload({
      ...form,
      image_url: imageUrl,
      parent_id: form.parent_id || null,
      display_order: Number(form.display_order) || 0,
    })

    try {
      if (isEdit) {
        await update.mutateAsync({ id: category.id, ...payload })
        toast.success('Category updated')
      } else {
        await create.mutateAsync(payload)
        toast.success('Category created')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err.message || 'Save failed')
    }
  }

  const parentOptions = (categories || []).filter((c) => c.id !== category?.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit category' : 'New category'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update category details.' : 'Add a catalog category.'}</DialogDescription>
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
                    <Input value={form.description || ''} onChange={(e) => updateField('description', e.target.value)} />
                  ) : (
                    <Input
                      value={form.description_ar || ''}
                      onChange={(e) => updateField('description_ar', e.target.value)}
                      dir="rtl"
                      className="text-right"
                    />
                  )}
                </div>
              </>
            )}
          </LocaleFieldTabs>

          {parentOptions.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Parent category</label>
              <Select
                value={form.parent_id || 'none'}
                onValueChange={(v) => updateField('parent_id', v === 'none' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="None (top level)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top level)</SelectItem>
                  {parentOptions.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Category image</label>
            {(imagePreview || form.image_url) ? (
              <div className="relative mb-2 inline-block">
                <img
                  src={imagePreview || form.image_url}
                  alt=""
                  className="h-20 w-20 rounded-xl object-cover"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#b3261e] text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null}
            <div
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gold/40 bg-ivory-3 px-4 py-3 text-sm text-muted hover:border-gold/60"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {imageFile ? imageFile.name : 'Click to upload image (JPG, PNG, WebP)'}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleImageChange}
            />
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
          <Button type="submit" className="w-full" disabled={uploading}>
            {uploading ? 'Uploading…' : isEdit ? 'Save' : 'Create'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
