import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileUploadField } from '@/components/ui/file-upload-field'
import { LabeledSelect } from '@/components/ui/labeled-select'
import { CustomerSearchField } from '@/components/admin/customers/CustomerSearchField'
import { uploadSchemeIdProof } from '@/lib/storage'
import { formatAED } from '@/lib/pricing'
import { SchemePayloadError } from '@/lib/schemePayload'

export function AdminEnrollCustomerDialog({
  open,
  onOpenChange,
  schemes = [],
  onConfirm,
  isSubmitting,
}) {
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [schemeId, setSchemeId] = useState('')
  const [passportNumber, setPassportNumber] = useState('')
  const [idProofKey, setIdProofKey] = useState('')
  const [idProofName, setIdProofName] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  const activeSchemes = schemes.filter((s) => s.is_active)
  const selectedScheme = activeSchemes.find((s) => s.id === schemeId)

  const clearProof = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setIdProofKey('')
    setIdProofName('')
  }

  const reset = () => {
    setCustomer(null)
    setSchemeId('')
    setPassportNumber('')
    clearProof()
  }

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    if (!open) reset()
  }, [open])

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
      const key = await uploadSchemeIdProof(file, { portal: 'admin' })
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
    if (!customer?.id) {
      toast.error('Select a customer')
      return
    }
    if (!schemeId) {
      toast.error('Select a scheme plan')
      return
    }
    const passport = passportNumber.trim()
    if (!passport && !idProofKey) {
      toast.error('Upload ID proof or enter passport number')
      return
    }
    try {
      const enrollment = await onConfirm({
        customer_id: customer.id,
        scheme_id: schemeId,
        ...(passport ? { passport_number: passport } : {}),
        ...(idProofKey ? { id_proof_key: idProofKey } : {}),
      })
      handleOpenChange(false)
      if (enrollment?.id) {
        navigate(`/admin/schemes/enrollments/${enrollment.id}`)
      }
    } catch (err) {
      const message = err instanceof SchemePayloadError
        ? err.message
        : (err?.message || 'Enrollment failed')
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enroll customer</DialogTitle>
          <DialogDescription>
            Search for a customer, choose an active plan, and capture ID proof or passport number.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <CustomerSearchField
            value={customer}
            onChange={setCustomer}
            disabled={isSubmitting || uploading}
          />

          <LabeledSelect
            label="Scheme plan"
            hint="Only active plans are listed."
            value={schemeId}
            onValueChange={setSchemeId}
            placeholder="Select plan…"
            disabled={isSubmitting || activeSchemes.length === 0}
            options={activeSchemes.map((scheme) => ({
              value: scheme.id,
              label: `${scheme.name} · ${formatAED(scheme.monthly_amount)}/mo · ${scheme.tenure_months} mo`,
            }))}
          />
          {selectedScheme ? (
            <p className="-mt-2 text-xs text-muted">
              {selectedScheme.bonus_months
                ? `${selectedScheme.bonus_months} bonus month(s)`
                : 'No bonus months'}
              {selectedScheme.benefit_type === 'fixed_amount' && selectedScheme.benefit_fixed_amount
                ? ` · ${formatAED(selectedScheme.benefit_fixed_amount)} fixed benefit`
                : ''}
            </p>
          ) : null}

          <FileUploadField
            label="ID proof"
            hint="Accepted: JPG, PNG, WebP, or PDF."
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
            <label htmlFor="admin-scheme-passport" className="block text-sm font-medium text-navy">
              Passport number
            </label>
            <Input
              id="admin-scheme-passport"
              value={passportNumber}
              onChange={(e) => setPassportNumber(e.target.value)}
              placeholder="Enter passport number"
              maxLength={50}
              disabled={isSubmitting}
              className="rounded-2xl"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || uploading || !customer || !schemeId}
          >
            {isSubmitting ? 'Enrolling…' : 'Enroll customer'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
