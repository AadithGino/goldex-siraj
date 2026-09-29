const AMOUNT_REASONS = new Set(['order_amount_too_high', 'order_amount_too_low'])

/** Tabby checkout alternative copy: 4 monthly payments (includes Tabby service fee factor). */
export function tabbyInstallmentEstimate(orderTotal) {
  const total = Number(orderTotal)
  if (!Number.isFinite(total) || total <= 0) return null
  return Math.round(((total * 1.015) / 4) * 100) / 100
}

/** Approved customer-facing copy for a Tabby rejection / unavailability reason. */
export function tabbyUnavailableMessage(reason, t) {
  if (reason === 'email_required') return t('checkout:tabby.emailRequired')
  if (reason === 'phone_required') return t('checkout:tabby.phoneRequired')
  if (AMOUNT_REASONS.has(reason)) return t(`checkout:tabby.rejected.${reason}`)
  return t('checkout:tabby.rejected.not_available')
}

/** Maps API errors from session creation to a rejection reason, or null for other errors. */
export function tabbyReasonFromError(err) {
  if (err?.code === 'TABBY_REJECTED') return err.details?.rejection_reason || 'not_available'
  if (err?.code === 'TABBY_EMAIL_REQUIRED') return 'email_required'
  if (err?.code === 'TABBY_PHONE_REQUIRED') return 'phone_required'
  return null
}
