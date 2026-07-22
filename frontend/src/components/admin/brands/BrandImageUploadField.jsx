import { useRef, useState } from 'react'
import { Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { uploadBannerImage } from '@/lib/storage'
import { cn } from '@/lib/utils'

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/svg+xml'

function validateImageFile(file) {
  if (!file?.type?.startsWith('image/')) {
    return 'Please choose an image file'
  }
  return null
}

export function BrandImageUploadField({
  label,
  value,
  onChange,
  uploadFolder,
  aspectClass = 'aspect-[16/9]',
}) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = async (file) => {
    if (!file) return
    const err = validateImageFile(file)
    if (err) {
      toast.error(err)
      return
    }
    setUploading(true)
    try {
      const url = await uploadBannerImage(file, uploadFolder)
      onChange(url)
      toast.success(`${label} uploaded`)
    } catch (uploadError) {
      toast.error(uploadError.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="block text-sm font-medium text-navy">{label}</label>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted hover:text-[#b3261e]"
            onClick={() => onChange('')}
          >
            <X className="mr-1 h-3 w-3" />
            Remove
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={IMAGE_ACCEPT}
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {value ? (
        <div className="overflow-hidden rounded-xl border border-line bg-ivory-3">
          <img src={value} alt="" className={cn('w-full object-cover', aspectClass)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleFile(e.dataTransfer.files?.[0])
          }}
          className={cn(
            'flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-sm transition-colors',
            dragOver ? 'border-gold bg-gold/5' : 'border-gold/30 bg-ivory-2 hover:border-gold/60'
          )}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin text-gold" /> : <Upload className="h-5 w-5 text-gold" />}
          <span className="mt-1 text-xs text-muted">Drop image or click to upload</span>
        </button>
      )}
    </div>
  )
}
