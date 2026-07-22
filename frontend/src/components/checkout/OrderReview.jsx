import { useTranslation } from 'react-i18next'
import { CouponInput } from '@/components/cart/CouponInput'
import { formatAED } from '@/lib/pricing'

export function OrderReview({
  totals,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
}) {
  const { t } = useTranslation('checkout')
  const quoteDiscount = totals?.coupon?.discount_amount
  const displayCoupon = appliedCoupon
    ? {
        ...appliedCoupon,
        discount: quoteDiscount != null ? Number(quoteDiscount) : Number(appliedCoupon.discount || 0),
      }
    : null

  return (
    <div className="rounded-lg border border-line bg-white p-3 sm:p-4">
      <h3 className="text-sm font-semibold text-navy">{t('coupon')}</h3>
      <p className="mt-0.5 text-xs text-muted">{t('couponHint')}</p>
      {totals?.error && (
        <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Quote failed — coupon savings are unavailable until retry succeeds.
        </p>
      )}
      <div className="mt-3">
        <CouponInput
          orderTotal={totals.subtotal}
          appliedCoupon={displayCoupon}
          onApply={(row) => onApplyCoupon({ code: row.code })}
          onRemove={onRemoveCoupon}
        />
      </div>
      {displayCoupon && quoteDiscount != null && (
        <p className="mt-2 text-xs text-muted">
          Quote coupon savings: {formatAED(quoteDiscount)}
        </p>
      )}
    </div>
  )
}
