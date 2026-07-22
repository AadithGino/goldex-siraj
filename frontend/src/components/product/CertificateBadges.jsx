import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { getBadgeVariant } from '@/lib/certificates'
import { getCertificateBadgeLabel } from '@/lib/i18nLabels'
import { cn } from '@/lib/utils'

export function CertificateBadges({
  certificates = [],
  variantId,
  className,
  size = 'sm',
}) {
  const { t } = useTranslation('product')
  if (!certificates?.length) return null

  const scoped = certificates.filter(
    (c) => !c.variant_id || !variantId || c.variant_id === variantId
  )
  const seen = new Set()
  const badges = scoped.filter((c) => {
    const key = (c.authority || '').toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (!badges.length) return null

  const sizeClass = size === 'xs' ? 'text-[10px] px-2 py-0.5' : ''

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {badges.map((cert) => (
        <Badge
          key={cert.id || cert.authority}
          variant={getBadgeVariant(cert)}
          className={sizeClass}
        >
          {getCertificateBadgeLabel(cert.authority, t)}
        </Badge>
      ))}
    </div>
  )
}
