import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileUploadField } from '@/components/ui/file-upload-field'
import { uploadSchemeIdProof } from '@/lib/storage'

export function SchemeEnrollmentIdentityPanel({ enrollment, onSave, canEdit = false }) {
  const [passportNumber, setPassportNumber] = useState(enrollment?.passport_number || '')
  const [idProofKey, setIdProofKey] = useState('')
  const [idProofName, setIdProofName] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setPassportNumber(enrollment?.passport_number || '')
  }, [enrollment?.passport_number, enrollment?.id])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const clearNewProof = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setIdProofKey('')
    setIdProofName('')
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
      const key = await uploadSchemeIdProof(file, { portal: 'admin' })
      setIdProofKey(key)
      setIdProofName(file.name)
      toast.success('ID proof uploaded')
    } catch (err) {
      toast.error(err.message || 'Upload failed')
      clearNewProof()
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        passport_number: passportNumber.trim() || null,
        ...(idProofKey ? { id_proof_key: idProofKey } : {}),
      })
      clearNewProof()
      toast.success('Identity details updated')
    } catch (err) {
      toast.error(err.message || 'Could not update identity details')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-6 rounded-[28px] border border-gold/20 bg-ivory-2 p-5 sm:p-6">
      <p className="text-sm font-semibold text-navy">Identity verification</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-ivory px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">Passport</p>
          <p className="mt-1 text-sm font-medium text-navy">
            {enrollment?.passport_number || 'Not provided'}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-ivory px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">ID proof</p>
          {enrollment?.id_proof_url ? (
            <a
              href={enrollment.id_proof_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:underline"
            >
              View document
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <p className="mt-1 text-sm text-muted">No file on record</p>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="mt-5 space-y-4 border-t border-line pt-5">
          <p className="text-xs font-semibold uppercase tracking-[.08em] text-gold">Update details</p>

          <div className="space-y-1.5">
            <label htmlFor="admin-scheme-passport" className="block text-sm font-medium text-navy">
              Passport number
            </label>
            <Input
              id="admin-scheme-passport"
              value={passportNumber}
              onChange={(e) => setPassportNumber(e.target.value)}
              placeholder="Enter passport number"
              maxLength={50}
              className="rounded-2xl"
            />
          </div>

          <FileUploadField
            label="Replace ID proof"
            hint="Upload a new Emirates ID or passport copy. Leave empty to keep the current file."
            fileName={idProofName}
            previewUrl={previewUrl}
            uploading={uploading}
            disabled={saving}
            onFile={handleFile}
            onClear={clearNewProof}
          />

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || uploading}
          >
            {saving ? 'Saving…' : 'Save identity details'}
          </Button>
        </div>
      )}
    </div>
  )
}
