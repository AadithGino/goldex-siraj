import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileCheck, ExternalLink } from 'lucide-react'
import { useCertificates, CUSTOMER_CERTIFICATE_PAGE_SIZE } from '@/hooks/useCertificates'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { certificatesForVariant, getAuthorityMeta } from '@/lib/certificates'
import { getCertificateBadgeLabel } from '@/lib/i18nLabels'
import { formatCertificateIssuedDate } from '@/lib/certificateDates'

/**
 * When `certificates` prop is provided (e.g. hydrated product), scope client-side.
 * When fetching, rely on server applicable_variant_id filtering + pagination meta.
 * Do not treat one page as the complete certificate collection.
 */
export function CertificatePreview({ productId, variantId, certificates: certificatesProp, embedded = false }) {
  const { t } = useTranslation(['product', 'common'])
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [productId, variantId])

  const fetching = !certificatesProp
  const { data: fetched, isLoading, isFetching } = useCertificates(
    fetching ? productId : null,
    variantId,
    { page, limit: CUSTOMER_CERTIFICATE_PAGE_SIZE },
  )

  const meta = fetched?.meta || null
  const scoped = certificatesProp
    ? certificatesForVariant(certificatesProp, variantId)
    : (fetched?.data || [])

  const total = certificatesProp ? scoped.length : (meta?.total ?? scoped.length)
  const totalPages = certificatesProp ? 1 : Math.max(1, meta?.pages || 1)
  const listIncomplete = fetching && meta != null && (meta.pages || 1) > 1

  if (isLoading && fetching && page === 1) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    )
  }

  if (!scoped?.length) {
    return null
  }

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-4'}>
      {!embedded && (
        <h2 className="flex items-center gap-2 font-display text-lg text-navy">
          <FileCheck className="h-5 w-5 text-gold" />
          {t('product:certificateDetails')}
        </h2>
      )}

      {listIncomplete && (
        <p className="text-xs text-muted" data-testid="cert-list-incomplete">
          Showing page {meta.page || page} of {totalPages} · {total} total — list may be incomplete on this page
        </p>
      )}

      {scoped.map((cert) => {
        const metaAuth = getAuthorityMeta(cert.authority)
        const issuedDate = formatCertificateIssuedDate(cert.issued_date, '')

        return (
          <div
            key={cert.id}
            className="space-y-3 rounded-2xl border border-gold/20 bg-ivory-2 p-5 sm:space-y-4 sm:p-6"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={metaAuth?.badgeVariant || 'gold'}>
                {getCertificateBadgeLabel(cert.authority, t)}
              </Badge>
              {cert.cert_number && (
                <span className="text-xs text-muted">
                  {t('common:reportNumber', { number: cert.cert_number })}
                </span>
              )}
            </div>
            {metaAuth?.appliesTo && (
              <p className="text-sm text-muted">{t('product:cert.fallbackAppliesTo')}</p>
            )}
            {issuedDate && (
              <p className="text-xs text-muted">{t('common:issuedDate', { date: issuedDate })}</p>
            )}
            {cert.metadata && Object.keys(cert.metadata).length > 0 && (
              <dl className="grid gap-2 rounded-xl bg-ivory-3 p-3 text-sm sm:grid-cols-2">
                {Object.entries(cert.metadata).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3">
                    <dt className="capitalize text-muted">{key.replace(/_/g, ' ')}</dt>
                    <dd className="font-medium text-navy">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {cert.file_url ? (
              <Button variant="outline" size="sm" asChild>
                <a href={cert.file_url} target="_blank" rel="noopener noreferrer">
                  {t('product:downloadCertificate')}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            ) : (
              <p className="text-xs text-muted">{t('product:digitalCopyOnRequest')}</p>
            )}
          </div>
        )
      })}

      {fetching && totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">
            Page {meta?.page || page} of {totalPages} · {CUSTOMER_CERTIFICATE_PAGE_SIZE} per page
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
