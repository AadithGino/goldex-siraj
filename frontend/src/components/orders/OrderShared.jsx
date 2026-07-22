import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/pricing'

const RETURN_STATUS_VARIANT = {
  requested: 'gold',
  approved: 'outline',
  rejected: 'destructive',
  completed: 'success',
}

const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="#f4efe4"/><circle cx="60" cy="48" r="18" fill="none" stroke="#b8902f" stroke-width="3"/><path d="M30 92c8-16 22-24 30-24s22 8 30 24" fill="none" stroke="#b8902f" stroke-width="3"/><text x="60" y="112" text-anchor="middle" font-size="10" fill="#7a6a4a" font-family="sans-serif">Jewellery</text></svg>`,
  )

export function productImageSrc(url) {
  return url || PLACEHOLDER
}

/** Returns that still need staff or customer attention */
export function getPendingOrderRequests(returns = [], orderStatus) {
  return (returns || []).filter((r) => canActOnReturnRequest(r, orderStatus))
}

/** Whether admin can still approve/reject this request */
export function canActOnReturnRequest(r, orderStatus) {
  if (!r || r.status === 'rejected' || r.status === 'completed') return false

  if (r.kind === 'cancellation') {
    if (orderStatus === 'cancelled') return false
    return r.status === 'requested'
  }

  if (r.kind === 'return') {
    if (orderStatus === 'returned') return false
    return r.status === 'requested' || r.status === 'approved'
  }

  return r.status === 'requested'
}

export function isReturnRequestOpen(r, orderStatus) {
  if (!r || r.status === 'rejected' || r.status === 'completed') return false
  if (r.kind === 'cancellation' && orderStatus === 'cancelled') return false
  if (r.kind === 'return' && orderStatus === 'returned') return false
  return r.status === 'requested' || r.status === 'approved'
}

export function OrderRequestBadges({ returns = [], orderStatus, className }) {
  const { t } = useTranslation(['orders'])
  const pending = (returns || []).filter((r) => isReturnRequestOpen(r, orderStatus))
  if (!pending.length) return null

  return (
    <div className={className}>
      {pending.map((r) => (
        <Badge
          key={r.id}
          variant={RETURN_STATUS_VARIANT[r.status] || 'muted'}
          className="capitalize"
        >
          {r.kind === 'cancellation'
            ? t('orders:badge.cancellation', { status: t(`orders:returnStatus.${r.status}`, r.status) })
            : t('orders:badge.return', { status: t(`orders:returnStatus.${r.status}`, r.status) })}
        </Badge>
      ))}
    </div>
  )
}

export function OrderItemsList({ items, showCustomization = true, detailed = false }) {
  const { t } = useTranslation(['orders', 'common'])

  if (!items?.length) {
    return <p className="text-sm text-muted">{t('orders:noItems')}</p>
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const name = item.product_name || t('orders:items')
        const content = (
          <div className="flex gap-3">
            <img
              src={productImageSrc(item.image_url)}
              alt={name}
              className="h-16 w-16 shrink-0 rounded-xl object-cover sm:h-20 sm:w-20"
              loading="lazy"
            />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-navy">
                    {item.product_slug ? (
                      <Link to={`/product/${item.product_slug}`} className="hover:text-gold hover:underline">
                        {name}
                      </Link>
                    ) : name}
                  </p>
                  <p className="text-xs text-muted">
                    {item.sku ? `${t('orders:sku')}: ${item.sku}` : null}
                    {item.sku && (item.variant_label || item.purity) ? ' · ' : ''}
                    {item.variant_label}
                    {item.purity ? ` · ${String(item.purity).toUpperCase()}` : ''}
                  </p>
                  {detailed && (
                    <p className="mt-1 text-xs text-muted">
                      {item.weight_grams != null && `${t('orders:grossWeight')}: ${Number(item.weight_grams)}g`}
                      {item.effective_weight != null && ` · ${t('orders:netGoldWeight')}: ${Number(item.effective_weight)}g`}
                      {` · ${t('orders:quantity')}: ${item.qty}`}
                    </p>
                  )}
                  {!detailed && (
                    <p className="text-xs text-muted">
                      {(item.effective_weight ?? item.weight_grams) != null
                        ? ` · ${Number(item.effective_weight ?? item.weight_grams)}g`
                        : ''}
                      {` · ${item.qty} × ${formatINR(item.unit_price)}`}
                    </p>
                  )}
                  {detailed && item.stone_charge > 0 && (
                    <p className="mt-1 text-xs text-muted">
                      {t('orders:stoneCharge')}: {formatINR(item.stone_charge)}
                    </p>
                  )}
                </div>
                {item.line_total != null && (
                  <span className="shrink-0 text-gold">{formatINR(item.line_total)}</span>
                )}
              </div>
              {showCustomization && item.customization_request && (
                <div className="mt-2 rounded-xl bg-ivory-3 px-3 py-2 text-xs">
                  <span className="font-semibold text-navy">{t('orders:customization')}: </span>
                  <span className="text-muted">{item.customization_request}</span>
                </div>
              )}
            </div>
          </div>
        )

        return (
          <div key={item.id || `${item.product_id}-${item.variant_id}-${item.sku}`} className="border-b border-gold/10 pb-3 last:border-0 last:pb-0">
            {content}
          </div>
        )
      })}
    </div>
  )
}
