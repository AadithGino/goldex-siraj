import { formatVariantSize } from '@/lib/constants'

export function normalizeWhatsAppDigits(raw) {
  if (raw == null || raw === '') return null
  const digits = String(raw).replace(/\D/g, '')
  return digits || null
}

export function pickProductImageUrl(images = [], variantId) {
  const sorted = [...images].sort(
    (a, b) =>
      Number(b.is_primary) - Number(a.is_primary) ||
      (a.display_order ?? 0) - (b.display_order ?? 0),
  )
  const forVariant = sorted.filter(
    (img) => !img.variant_id || img.variant_id === variantId,
  )
  const pool = forVariant.length ? forVariant : sorted
  return pool[0]?.url || null
}

export function formatVariantEnquiryLine(variant) {
  if (!variant) return null
  const parts = []
  const label = String(variant.variant_label || variant.label || '').trim()
  if (label) parts.push(label)
  const sizePart = formatVariantSize(variant)
  if (sizePart && sizePart !== label) parts.push(sizePart)
  if (variant.weight_grams != null && variant.weight_grams !== '') {
    parts.push(`${variant.weight_grams}g`)
  }
  return parts.length ? parts.join(' · ') : null
}

export function buildWhatsAppEnquiryMessage({
  t,
  productName,
  variant,
  imageUrl,
  productUrl,
  priceLabel,
}) {
  const lines = [t('product:whatsappEnquiry.intro'), '']
  lines.push(`${t('product:whatsappEnquiry.product')}: ${productName}`)

  const variantLine = formatVariantEnquiryLine(variant)
  if (variantLine) {
    lines.push(`${t('product:whatsappEnquiry.variant')}: ${variantLine}`)
  }
  if (variant?.sku) {
    lines.push(`${t('product:whatsappEnquiry.sku')}: ${variant.sku}`)
  }
  if (priceLabel) {
    lines.push(`${t('product:whatsappEnquiry.price')}: ${priceLabel}`)
  }
  if (imageUrl) {
    lines.push(`${t('product:whatsappEnquiry.image')}: ${imageUrl}`)
  }
  if (productUrl) {
    lines.push(`${t('product:whatsappEnquiry.link')}: ${productUrl}`)
  }
  return lines.join('\n')
}

export function buildWhatsAppChatUrl(phoneDigits, message) {
  const phone = normalizeWhatsAppDigits(phoneDigits)
  if (!phone || !message) return null
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}
