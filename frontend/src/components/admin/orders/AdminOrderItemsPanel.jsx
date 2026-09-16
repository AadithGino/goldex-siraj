import { formatINR } from '@/lib/pricing'
import { CompactPanel } from '@/components/shared/CompactPanel'
import { productImageSrc } from '@/components/orders/OrderShared'

export function AdminOrderItemsPanel({ order }) {
  const items = order?.order_items || []

  return (
    <CompactPanel
      title={`Order items (${items.length})`}
      className="min-w-0 overflow-hidden border-navy/15 ring-1 ring-navy/5"
    >
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.id || `${item.sku}-${item.variant_id}`} className="py-3 first:pt-0 last:pb-0">
            <div className="flex gap-3">
              <img
                src={productImageSrc(item.image_url)}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy" title={item.product_name}>
                      {item.product_name}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {[item.sku, item.variant_label, item.purity?.toUpperCase()]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                    {item.customization_request && (
                      <p className="mt-1 truncate rounded bg-gold/10 px-1.5 py-0.5 text-[10px] font-medium text-navy">
                        Custom: {item.customization_request}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-right font-semibold tabular-nums text-gold">
                    {formatINR(item.line_total)}
                  </p>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-3">
                  <div className="flex min-w-0 justify-between gap-2">
                    <dt className="shrink-0 text-muted">Qty</dt>
                    <dd className="tabular-nums text-navy">{item.qty}</dd>
                  </div>
                  <div className="flex min-w-0 justify-between gap-2">
                    <dt className="shrink-0 text-muted">Gross</dt>
                    <dd className="tabular-nums text-navy">
                      {item.weight_grams != null ? `${Number(item.weight_grams)}g` : '—'}
                    </dd>
                  </div>
                  <div className="flex min-w-0 justify-between gap-2">
                    <dt className="shrink-0 text-muted">Net</dt>
                    <dd className="tabular-nums text-navy">
                      {item.effective_weight != null ? `${Number(item.effective_weight)}g` : '—'}
                    </dd>
                  </div>
                  <div className="flex min-w-0 justify-between gap-2">
                    <dt className="shrink-0 text-muted">Making</dt>
                    <dd className="min-w-0 truncate tabular-nums text-navy">
                      {formatINR(item.making_charge || 0)}
                    </dd>
                  </div>
                  <div className="flex min-w-0 justify-between gap-2">
                    <dt className="shrink-0 text-muted">Stone</dt>
                    <dd className="min-w-0 truncate tabular-nums text-navy">
                      {formatINR(item.stone_charge || 0)}
                    </dd>
                  </div>
                  <div className="flex min-w-0 justify-between gap-2">
                    <dt className="shrink-0 text-muted">Unit</dt>
                    <dd className="min-w-0 truncate tabular-nums text-navy">
                      {formatINR(item.unit_price)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-sm">
        <span className="min-w-0 break-words text-muted">
          {order?.coupon_code && `Coupon ${order.coupon_code} · `}
          {order?.is_gift && <span className="font-semibold text-gold">Gift order · </span>}
          Payment: {order?.payment_method?.toUpperCase()}
        </span>
        <span className="shrink-0 font-display text-lg font-semibold text-gold">
          {formatINR(order?.final_total ?? order?.total)}
        </span>
      </div>
      {order?.is_gift && order?.gift_note && (
        <p className="mt-2 break-words rounded border border-gold/25 bg-ivory-3 px-2 py-1.5 text-[11px] text-navy">
          <span className="font-semibold">Gift note:</span> {order.gift_note}
        </p>
      )}
    </CompactPanel>
  )
}
