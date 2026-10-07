import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon'
import { Button } from '@/components/ui/button'
import { useStoreSettings } from '@/hooks/useStoreSettings'
import { usePriceBreakup } from '@/hooks/usePriceBreakup'
import { formatINR } from '@/lib/pricing'
import {
  STORE_WHATSAPP_E164,
  resolveStoreWhatsAppE164,
} from '@/lib/storeIdentity'
import {
  buildWhatsAppChatUrl,
  buildWhatsAppEnquiryMessage,
  pickProductImageUrl,
} from '@/lib/whatsappEnquiry'
import { cn } from '@/lib/utils'

export function ProductWhatsAppEnquiry({
  product,
  productName,
  variant,
  variantId,
  className,
  iconOnly = false,
  layout = 'full',
  compact = false,
}) {
  const { t } = useTranslation(['product'])
  const { data: settings } = useStoreSettings()
  const { data: breakup } = usePriceBreakup(variantId)

  const href = useMemo(() => {
    if (!productName) return null
    const phone = resolveStoreWhatsAppE164(settings) || STORE_WHATSAPP_E164
    const price =
      breakup?.display_total ?? breakup?.total
    const priceLabel = price != null ? formatINR(price) : null
    const imageUrl = pickProductImageUrl(product?.product_images, variantId)
    const productUrl =
      typeof window !== 'undefined' ? window.location.href : null
    const message = buildWhatsAppEnquiryMessage({
      t,
      productName,
      variant,
      imageUrl,
      productUrl,
      priceLabel,
    })
    return buildWhatsAppChatUrl(phone, message)
  }, [product?.product_images, productName, settings, t, variant, variantId, breakup])

  if (!href) return null

  const fullLabel = t('product:whatsappEnquiry.button')
  const label =
    compact && layout === 'row'
      ? t('product:whatsappEnquiry.buttonShort')
      : fullLabel
  const whatsappLinkClass =
    'border-[#25D366] bg-white text-[#25D366] shadow-none transition-colors hover:border-[#1da851] hover:bg-[#25D366]/8 hover:text-[#1da851]'

  if (iconOnly) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2',
          whatsappLinkClass,
          className,
        )}
        aria-label={fullLabel}
      >
        <WhatsAppIcon className="h-6 w-6" />
      </a>
    )
  }

  const isRow = layout === 'row'
  const rowHeight = compact ? 'h-12 min-h-12' : 'h-[52px] min-h-[52px]'

  return (
    <Button
      variant="outline"
      asChild
      className={cn(
        'gap-2 font-semibold shadow-none',
        isRow
          ? cn(
              rowHeight,
              'w-full min-w-0 !rounded-xl !whitespace-normal border px-3 py-0 sm:px-4',
              'text-[11px] leading-snug sm:text-xs',
            )
          : 'min-h-[52px] w-full gap-2.5 rounded-full border-2 text-base',
        !isRow && 'border-2',
        isRow && 'border',
        whatsappLinkClass,
        className,
      )}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={isRow ? fullLabel : undefined}
        className={cn(isRow && 'flex h-full w-full items-center justify-center gap-2')}
      >
        <WhatsAppIcon
          className={cn(
            'shrink-0',
            isRow ? 'h-[22px] w-[22px] sm:h-6 sm:w-6' : 'h-[22px] w-[22px]',
          )}
        />
        {isRow ? (
          <span className="min-w-0 whitespace-normal text-center">{label}</span>
        ) : (
          label
        )}
      </a>
    </Button>
  )
}
