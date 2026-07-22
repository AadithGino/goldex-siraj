import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useContentLang } from '@/hooks/useContentLang'
import { getDefaultVariant } from '@/hooks/useProducts'
import { usePriceBreakup } from '@/hooks/usePriceBreakup'
import { pickField } from '@/lib/contentLocale'
import { formatINR } from '@/lib/pricing'
import { AddToBagButton } from '@/components/product/AddToBagButton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CertificateBadges } from '@/components/product/CertificateBadges'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

function QuickViewBody({ product }) {
  const { t } = useTranslation(['product', 'common'])
  const lang = useContentLang()
  const variant = getDefaultVariant(product)
  const { data: breakup, isLoading } = usePriceBreakup(variant?.id)
  const displayName = pickField(product, 'name', lang)
  const shortDesc = pickField(product, 'short_desc', lang)

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl">
        {product.primary_image ? (
          <img
            src={product.primary_image}
            alt={displayName}
            className="h-56 w-full object-cover sm:h-72"
          />
        ) : (
          <div className="flex h-56 items-center justify-center bg-ivory-3 text-muted">
            {t('common:noImage')}
          </div>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="navy">{product.purity?.toUpperCase()}</Badge>
          <CertificateBadges certificates={product.certificates} variantId={variant?.id} size="xs" />
        </div>
        <h3 className="mt-2 font-display text-2xl text-navy">{displayName}</h3>
        {shortDesc && <p className="mt-2 text-sm text-muted">{shortDesc}</p>}
      </div>

      <div>
        {isLoading ? (
          <Skeleton className="h-8 w-32" />
        ) : breakup ? (
          <p className="font-display text-2xl text-gold">{formatINR(breakup.display_total ?? breakup.total)}</p>
        ) : (
          <p className="text-sm text-muted">{t('product:priceUnavailable')}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <AddToBagButton variantId={variant?.id} className="flex-1" onSuccess={() => {}} />
        <Button asChild variant="outline" className="flex-1">
          <Link to={`/product/${product.slug}`}>{t('product:viewDetails')}</Link>
        </Button>
      </div>
    </div>
  )
}

export function QuickViewDialog({ product, open, onOpenChange }) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const lang = useContentLang()
  const displayName = product ? pickField(product, 'name', lang) : ''

  if (!product) return null

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-left">{displayName}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <QuickViewBody product={product} />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{displayName}</DialogTitle>
          <DialogDescription>Quick product preview with pricing and options.</DialogDescription>
        </DialogHeader>
        <QuickViewBody product={product} />
      </DialogContent>
    </Dialog>
  )
}
