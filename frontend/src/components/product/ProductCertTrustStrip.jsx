import { useTranslation } from 'react-i18next'
import { ShieldCheck, ChevronDown } from 'lucide-react'
import { CertificateBadges } from '@/components/product/CertificateBadges'
import { certificatesForVariant } from '@/lib/certificates'
import { cn } from '@/lib/utils'

export function ProductCertTrustStrip({ certificates = [], variantId, onViewDetails }) {
  const { t } = useTranslation('product')
  const scoped = certificatesForVariant(certificates, variantId)

  if (!scoped.length) {
    return (
      <div className="rounded-2xl border border-gold/15 bg-ivory-3 px-4 py-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <div>
            <p className="text-sm font-medium text-navy">{t('authenticity')}</p>
            <p className="mt-0.5 text-xs text-muted">{t('authenticityOnRequest')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-ivory-2 to-ivory-3 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15">
            <ShieldCheck className="h-5 w-5 text-gold" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy">{t('certifiedAuthentic')}</p>
            <p className="mt-0.5 text-xs text-muted">{t('verifiedDocumentation')}</p>
            <CertificateBadges
              certificates={scoped}
              variantId={variantId}
              className="mt-3"
            />
          </div>
        </div>
      </div>
      {onViewDetails && (
        <button
          type="button"
          onClick={onViewDetails}
          className={cn(
            'mt-3 flex w-full items-center justify-center gap-1 rounded-full border border-gold/25',
            'bg-ivory px-3 py-2 text-xs font-semibold text-gold transition-colors hover:bg-ivory-2'
          )}
        >
          {t('viewCertificateDetails')}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
