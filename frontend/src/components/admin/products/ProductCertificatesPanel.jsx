import { useEffect, useState } from 'react'
import { Plus, Trash2, FileCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useAdminCertificates, useAdminCertificateMutations } from '@/hooks/useAdminCertificates'
import {
  CERTIFICATE_AUTHORITIES,
  getAuthorityMeta,
  getMetadataFieldsForAuthority,
} from '@/lib/certificates'
import { formatCertificateIssuedDate } from '@/lib/certificateDates'

/** Documented admin certificate page size (must stay ≤ backend maxLimit 100). */
export const ADMIN_CERTIFICATE_PAGE_SIZE = 10

const EMPTY_FORM = {
  cert_number: '',
  authority: 'Purity Certificate',
  authority_custom: '',
  variant_id: '',
  issued_date: '',
  metadata: {},
}

export function ProductCertificatesPanel({ productId, variants }) {
  const [page, setPage] = useState(1)
  const { data: certResponse, isLoading } = useAdminCertificates(productId, {
    page,
    limit: ADMIN_CERTIFICATE_PAGE_SIZE,
  })
  const certs = certResponse?.data || []
  const meta = certResponse?.meta || {}
  const totalPages = Math.max(1, meta.pages || 1)
  const { create, remove } = useAdminCertificateMutations()
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    setPage(1)
  }, [productId])

  // After delete, if this page is empty and page > 1, step back.
  useEffect(() => {
    if (isLoading) return
    if (certs.length === 0 && page > 1) {
      setPage((p) => Math.max(1, p - 1))
    }
  }, [certs.length, page, isLoading])

  const authorityValue = form.authority === 'Other' ? form.authority_custom : form.authority
  const authorityMeta = getAuthorityMeta(authorityValue)
  const metadataFields = getMetadataFieldsForAuthority(authorityValue)

  const setMeta = (key, value) =>
    setForm((p) => ({ ...p, metadata: { ...p.metadata, [key]: value } }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const file = e.target.cert_file?.files?.[0]
    const authority = authorityValue?.trim()

    if (!authority) {
      toast.error('Select or enter a certification authority')
      return
    }

    const metadata = {}
    for (const field of metadataFields) {
      const val = form.metadata[field.key]
      if (val) metadata[field.key] = val
    }

    try {
      await create.mutateAsync({
        productId,
        variantId: form.variant_id || null,
        file: file || null,
        cert_number: form.cert_number,
        authority,
        issued_date: form.issued_date || null,
        metadata,
      })
      toast.success('Certificate added — badge will show on storefront')
      setForm(EMPTY_FORM)
      setPage(1)
      e.target.reset()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gold/20 bg-ivory-3 px-4 py-3 text-sm text-muted">
        <p className="font-medium text-navy">Why certificates matter</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
          <li><strong className="text-navy">Purity Certificate</strong> — confirms metal purity and weight details</li>
          <li><strong className="text-navy">GIA / IGI / HRD / SGL / GII</strong> — independent diamond & gemstone grading</li>
          <li><strong className="text-navy">Upload PDF/image</strong> — lets customers view & download proof on the product page</li>
        </ul>
        <p className="mt-2 text-xs">Each authority you add shows as a badge on the customer product page.</p>
      </div>

      {isLoading && !certs.length ? (
        <p className="text-sm text-muted">Loading certificates…</p>
      ) : null}

      {!isLoading && !certs.length ? (
        <p className="text-sm text-muted">No certificates on this page yet.</p>
      ) : null}

      {certs?.map((c) => (
        <div key={c.id} className="flex items-start justify-between gap-3 rounded-2xl border border-gold/20 bg-ivory-3 p-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <FileCheck className="h-4 w-4 shrink-0 text-gold" />
              <p className="font-medium text-navy">{c.authority}</p>
              <Badge variant="outline" className="text-[10px]">#{c.cert_number}</Badge>
            </div>
            {c.issued_date && (
              <p className="mt-1 text-xs text-muted">
                Issued {formatCertificateIssuedDate(c.issued_date)}
              </p>
            )}
            {c.file_url ? (
              <a href={c.file_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-gold hover:underline">
                View uploaded file
              </a>
            ) : (
              <p className="mt-1 text-xs text-amber-700">No file — badge shown, customer sees details only</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted hover:text-[#b3261e]"
            onClick={async () => {
              try {
                await remove.mutateAsync({ id: c.id, productId })
                toast.success('Removed')
              } catch (e) {
                toast.error(e.message)
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Page {meta.page || page} of {totalPages} · {meta.total ?? 0} total
          {' '}· {ADMIN_CERTIFICATE_PAGE_SIZE} per page
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-gold/20 p-4">
        <p className="text-sm font-medium text-navy">Add certificate</p>

        <div>
          <label className="mb-2 block text-xs font-medium text-navy">Certification authority *</label>
          <Select
            value={form.authority}
            onValueChange={(v) => setForm((p) => ({ ...p, authority: v, metadata: {} }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CERTIFICATE_AUTHORITIES.map((a) => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.authority === 'Other' && (
            <Input
              className="mt-2"
              value={form.authority_custom}
              onChange={(e) => setForm((p) => ({ ...p, authority_custom: e.target.value }))}
              placeholder="Authority name"
              required
            />
          )}
          {authorityMeta && (
            <p className="mt-2 text-xs text-muted">{authorityMeta.appliesTo}</p>
          )}
        </div>

        <Input
          value={form.cert_number}
          onChange={(e) => setForm((p) => ({ ...p, cert_number: e.target.value }))}
          placeholder="Certificate / report number *"
          required
        />

        {metadataFields.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {metadataFields.map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-xs text-muted">{field.label}</label>
                <Input
                  value={form.metadata[field.key] || ''}
                  onChange={(e) => setMeta(field.key, e.target.value)}
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>
        )}

        <Select
          value={form.variant_id || 'all'}
          onValueChange={(v) => setForm((p) => ({ ...p, variant_id: v === 'all' ? '' : v }))}
        >
          <SelectTrigger><SelectValue placeholder="Applies to" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All variants (whole product)</SelectItem>
            {variants?.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.variant_label || v.sku}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={form.issued_date}
          onChange={(e) => setForm((p) => ({ ...p, issued_date: e.target.value }))}
        />

        <div>
          <label className="mb-2 block text-xs font-medium text-navy">
            Certificate file (PDF or image) — optional but recommended
          </label>
          <Input type="file" name="cert_file" accept=".pdf,image/*" />
          {authorityMeta && (
            <p className="mt-1 text-xs text-muted">{authorityMeta.whyUpload}</p>
          )}
        </div>

        <Button type="submit" size="sm">
          <Plus className="h-4 w-4" />
          Add certificate
        </Button>
      </form>
    </div>
  )
}
