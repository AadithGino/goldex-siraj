import { useRef, useState } from 'react'
import { Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  BANNER_IMAGE_ACCEPT,
  BANNER_IMAGE_MAX_MB,
  formatBannerSize,
} from '@/lib/bannerSpecs'
import { uploadBannerImage } from '@/lib/storage'
import { cn } from '@/lib/utils'

function validateBannerFile(file) {
  if (!file.type.startsWith('image/')) {
    return 'Please choose a JPG, PNG, or WebP image'
  }
  if (file.size > BANNER_IMAGE_MAX_MB * 1024 * 1024) {
    return `Image must be ${BANNER_IMAGE_MAX_MB} MB or smaller`
  }
  return null
}

function validateBannerImage(file, spec) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      const expectedRatio = spec.width / spec.height
      const actualRatio = image.width / image.height
      const diff = Math.abs(actualRatio - expectedRatio) / expectedRatio
      URL.revokeObjectURL(objectUrl)

      if (diff > 0.08) {
        resolve(
          `Wrong banner size. Please upload a horizontal image close to ${formatBannerSize(spec)}. Avoid 9:16 poster images.`
        )
        return
      }
      resolve(null)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve('Could not read image dimensions. Please try another file.')
    }

    image.src = objectUrl
  })
}

export function BannerImageField({
  label,
  spec,
  value,
  onChange,
  uploadFolder,
  aspectClass = 'aspect-[16/9]',
  required = true,
}) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = async (file) => {
    if (!file) return
    const fileError = validateBannerFile(file)
    if (fileError) {
      toast.error(fileError)
      return
    }

    const ratioError = await validateBannerImage(file, spec)
    if (ratioError) {
      toast.error(ratioError)
      return
    }

    setUploading(true)
    try {
      const url = await uploadBannerImage(file, uploadFolder)
      onChange(url)
      toast.success(`${label} uploaded`)
    } catch (err) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onInputChange = (e) => {
    handleFile(e.target.files?.[0])
    e.target.value = ''
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const openPicker = () => inputRef.current?.click()

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={BANNER_IMAGE_ACCEPT}
        className="hidden"
        disabled={uploading}
        onChange={onInputChange}
      />

      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <label className="block text-sm font-medium text-navy">
            {label}
            {required && <span className="text-[#b3261e]"> *</span>}
          </label>
          <p className="mt-0.5 text-xs text-muted">
            Recommended: {formatBannerSize(spec)} · Max {BANNER_IMAGE_MAX_MB} MB · JPG, PNG, WebP
          </p>
        </div>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 text-xs text-muted hover:text-[#b3261e]"
            onClick={() => onChange('')}
          >
            <X className="mr-1 h-3 w-3" />
            Remove
          </Button>
        )}
      </div>

      {value ? (
        <div className="overflow-hidden rounded-xl border border-line bg-ivory-3">
          <img src={value} alt="" className={`w-full object-cover ${aspectClass}`} />
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && openPicker()}
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 transition-colors',
            dragOver ? 'border-gold bg-gold/5' : 'border-gold/30 bg-ivory-2 hover:border-gold/50',
            uploading && 'pointer-events-none opacity-60'
          )}
        >
          {uploading ? (
            <Loader2 className="h-7 w-7 animate-spin text-gold" />
          ) : (
            <Upload className="h-7 w-7 text-gold" />
          )}
          <p className="mt-2 text-sm font-semibold text-navy">
            {uploading ? 'Uploading…' : 'Drop image or click to browse'}
          </p>
        </div>
      )}

      {value && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={uploading}
          onClick={openPicker}
        >
          Replace image
        </Button>
      )}
    </div>
  )
}
