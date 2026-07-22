import { useCallback, useState } from 'react'
import { Plus, Star, Trash2, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAdminProductMutations } from '@/hooks/useAdminProducts'
import { cn } from '@/lib/utils'

export function ProductImagesManager({ productId, images = [] }) {
  const { addImage, deleteImage, setPrimaryImage } = useAdminProductMutations()
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const sorted = [...images].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || Number(b.is_primary) - Number(a.is_primary)
  )

  const uploadFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'))
    if (!files.length) {
      toast.error('Please choose image files (JPG, PNG, WebP)')
      return
    }

    setUploading(true)
    let existing = sorted.length
    let uploaded = 0

    try {
      for (const file of files) {
        await addImage.mutateAsync({
          productId,
          file,
          alt: file.name.replace(/\.[^.]+$/, ''),
          isPrimary: existing === 0,
        })
        existing += 1
        uploaded += 1
      }
      toast.success(uploaded === 1 ? 'Image uploaded' : `${uploaded} images uploaded`)
    } catch (err) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [addImage, productId, sorted.length])

  const onInputChange = (e) => {
    uploadFiles(e.target.files)
    e.target.value = ''
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    uploadFiles(e.dataTransfer.files)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Add multiple photos — drag & drop or browse. The <strong className="text-navy">primary</strong> image
        appears on listing cards. Customers see all images in the product gallery.
      </p>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 transition-colors',
          dragOver ? 'border-gold bg-gold/5' : 'border-gold/30 bg-ivory-2 hover:border-gold/50',
          uploading && 'pointer-events-none opacity-60'
        )}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        ) : (
          <Upload className="h-8 w-8 text-gold" />
        )}
        <p className="mt-3 text-sm font-semibold text-navy">
          {uploading ? 'Uploading…' : 'Drop images here or click to browse'}
        </p>
        <p className="mt-1 text-xs text-muted">JPG, PNG, WebP · select multiple files at once</p>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={onInputChange}
        />
      </label>

      <div className="flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gold/30 bg-ivory-2 px-4 py-2 text-sm font-semibold text-navy hover:border-gold">
          <Plus className="h-4 w-4" />
          Add more images
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={onInputChange}
          />
        </label>
        <span className="text-xs text-muted">{sorted.length} image{sorted.length === 1 ? '' : 's'}</span>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/30 bg-ivory-2 p-8 text-center text-sm text-muted">
          No images yet. Upload at least one photo before publishing.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map((img, index) => (
            <div key={img.id} className="relative overflow-hidden rounded-2xl border border-gold/20 bg-ivory-3">
              <img src={img.url} alt={img.alt || `Product image ${index + 1}`} className="aspect-square w-full object-cover" />
              <span className="absolute right-2 top-2 rounded-full bg-navy/80 px-2 py-0.5 text-[10px] font-bold text-ivory">
                {index + 1}
              </span>
              {img.is_primary && (
                <span className="absolute left-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-navy">
                  Primary
                </span>
              )}
              <div className="flex gap-1 border-t border-gold/10 p-2">
                {!img.is_primary && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={async () => {
                      try {
                        await setPrimaryImage.mutateAsync({ id: img.id, productId })
                        toast.success('Primary image updated')
                      } catch (e) {
                        toast.error(e.message || 'Update failed')
                      }
                    }}
                  >
                    <Star className="h-3 w-3" />
                    Set primary
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted hover:text-[#b3261e]"
                  onClick={async () => {
                    try {
                      await deleteImage.mutateAsync({ id: img.id, productId })
                      toast.success('Image removed')
                    } catch (e) {
                      toast.error(e.message)
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
