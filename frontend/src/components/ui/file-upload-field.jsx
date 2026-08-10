import { useRef, useState } from 'react'
import { FileText, ImageIcon, Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function isImageFile(name = '', mime = '') {
  if (mime.startsWith('image/')) return true
  return /\.(jpe?g|png|webp|gif)$/i.test(name)
}

/**
 * Custom drag-and-drop file picker — hidden native input, Goldex-styled drop zone.
 */
export function FileUploadField({
  label,
  hint,
  accept = 'image/jpeg,image/png,image/webp,application/pdf',
  fileName,
  previewUrl,
  uploading = false,
  disabled = false,
  onFile,
  onClear,
  className,
}) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const hasFile = Boolean(fileName || previewUrl)
  const showImagePreview = previewUrl && isImageFile(fileName)

  const openPicker = () => {
    if (!disabled && !uploading) inputRef.current?.click()
  }

  const handleFile = (file) => {
    if (!file || disabled || uploading) return
    onFile?.(file)
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <div className="flex items-center justify-between gap-2">
          <label className="block text-sm font-medium text-navy">{label}</label>
          {hasFile && onClear ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted hover:text-[#b3261e]"
              onClick={onClear}
              disabled={uploading || disabled}
            >
              <X className="mr-1 h-3 w-3" />
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        disabled={disabled || uploading}
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {hasFile ? (
        <div className="overflow-hidden rounded-2xl border border-gold/20 bg-ivory-3">
          {showImagePreview ? (
            <img
              src={previewUrl}
              alt=""
              className="max-h-48 w-full object-contain bg-ivory-2 p-2"
            />
          ) : (
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-ivory-2">
                <FileText className="h-5 w-5 text-gold" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-navy">{fileName || 'Document uploaded'}</p>
                <p className="text-xs text-muted">Ready to submit</p>
              </div>
            </div>
          )}
          {!disabled && !uploading ? (
            <div className="border-t border-line px-4 py-2">
              <button
                type="button"
                onClick={openPicker}
                className="text-xs font-medium text-gold hover:underline"
              >
                Replace file
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault()
            if (!disabled && !uploading) setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleFile(e.dataTransfer.files?.[0])
          }}
          disabled={disabled || uploading}
          className={cn(
            'group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-all',
            dragOver
              ? 'border-gold bg-gold/10 shadow-[inset_0_0_0_1px_rgba(201,162,39,.15)]'
              : 'border-gold/25 bg-ivory-2 hover:border-gold/50 hover:bg-ivory-3',
            (disabled || uploading) && 'cursor-not-allowed opacity-60',
          )}
        >
          <div
            className={cn(
              'mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-ivory transition-colors',
              !uploading && !disabled && 'group-hover:border-gold/50 group-hover:bg-gold/5',
            )}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-gold" />
            ) : (
              <Upload className="h-5 w-5 text-gold" />
            )}
          </div>
          <p className="text-sm font-medium text-navy">
            {uploading ? 'Uploading…' : 'Drop file here or click to browse'}
          </p>
          <p className="mt-1 flex items-center justify-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <ImageIcon className="h-3.5 w-3.5" />
              JPG, PNG, WebP
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              PDF
            </span>
          </p>
        </button>
      )}

      {hint ? <p className="text-xs leading-relaxed text-muted">{hint}</p> : null}
    </div>
  )
}
