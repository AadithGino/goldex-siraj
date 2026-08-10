import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileUploadField } from '@/components/ui/file-upload-field'
import { uploadSchemeIdProof } from '@/lib/storage'

export function SchemeEnrollDialog({ open, onOpenChange, scheme, onConfirm, isSubmitting }) {
  const [passportNumber, setPassportNumber] = useState('')
  const [idProofKey, setIdProofKey] = useState('')
  const [idProofName, setIdProofName] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  const clearProof = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setIdProofKey('')
    setIdProofName('')
  }

  const reset = () => {
    setPassportNumber('')
    clearProof()
  }

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const handleOpenChange = (next) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleFile = async (file) => {
    if (!file) return
    const localPreview = file.type.startsWith('image/')
      ? URL.createObjectURL(file)
      : ''
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(localPreview)
    setUploading(true)
    try {
      const key = await uploadSchemeIdProof(file, { portal: 'customer' })
      setIdProofKey(key)
      setIdProofName(file.name)
      toast.success('ID proof uploaded')
    } catch (err) {
      toast.error(err.message || 'Upload failed')
      clearProof()
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const passport = passportNumber.trim()
    if (!passport && !idProofKey) {
      toast.error('Upload ID proof or enter passport number')
      return
    }
    try {
      await onConfirm({
        scheme_id: scheme.id,
        ...(passport ? { passport_number: passport } : {}),
        ...(idProofKey ? { id_proof_key: idProofKey } : {}),
      })
      handleOpenChange(false)
    } catch {
      // parent shows error toast
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll in {scheme?.name}</DialogTitle>
          <DialogDescription>
            Upload Emirates ID / passport copy, or enter passport number to complete enrollment.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <FileUploadField
            label="ID proof"
            hint="Accepted: JPG, PNG, WebP, or PDF. Max size per store policy."
            fileName={idProofName}
            previewUrl={previewUrl}
            uploading={uploading}
            disabled={isSubmitting}
            onFile={handleFile}
            onClear={clearProof}
          />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest">
              <span className="bg-ivory px-3 text-muted">or</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="scheme-passport" className="block text-sm font-medium text-navy">
              Passport number
            </label>
            <Input
              id="scheme-passport"
              value={passportNumber}
              onChange={(e) => setPassportNumber(e.target.value)}
              placeholder="Enter passport number"
              maxLength={50}
              disabled={isSubmitting}
              className="rounded-2xl"
            />
            <p className="text-xs text-muted">Use this if you prefer not to upload a document.</p>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting || uploading}>
            {isSubmitting ? 'Enrolling…' : 'Confirm enrollment'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
