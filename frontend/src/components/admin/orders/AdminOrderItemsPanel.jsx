import { formatINR } from '@/lib/pricing'
import { CompactPanel } from '@/components/shared/CompactPanel'
import { productImageSrc } from '@/components/orders/OrderShared'

export function AdminOrderItemsPanel({ order }) {
  const items = order?.order_items || []

  return (
    <CompactPanel
      title={`Order items (${items.length})`}
      className="border-navy/15 ring-1 ring-navy/5"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="border-b border-line bg-ivory-3/80 text-left text-[10px] font-bold uppercase tracking-wide text-muted">
              <th className="px-2 py-2">Item</th>
              <th className="px-2 py-2">SKU</th>
              <th className="px-2 py-2 text-right">Purity</th>
              <th className="px-2 py-2 text-right">Gross</th>
              <th className="px-2 py-2 text-right">Net</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">Making</th>
              <th className="px-2 py-2 text-right">Stone</th>
              <th className="px-2 py-2 text-right">Unit</th>
              <th className="px-2 py-2 text-right">Line</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id || `${item.sku}-${item.variant_id}`} className="border-b border-line/60 hover:bg-ivory-3/50">
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={productImageSrc(item.image_url)}
                      alt={item.product_name || 'Product'}
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                    <div>
                      <p className="font-semibold text-navy">{item.product_name}</p>
                      {item.variant_label && (
                        <p className="text-[10px] text-muted">{item.variant_label}</p>
                      )}
                      {item.customization_request && (
                        <p className="mt-0.5 rounded bg-gold/10 px-1.5 py-0.5 text-[10px] font-medium text-navy">
                          Custom: {item.customization_request}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2 font-mono text-[10px] text-muted">{item.sku || '—'}</td>
                <td className="px-2 py-2 text-right uppercase text-muted">{item.purity || '—'}</td>
                <td className="px-2 py-2 text-right tabular-nums text-muted">
                  {item.weight_grams != null ? `${Number(item.weight_grams)}g` : '—'}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-muted">
                  {item.effective_weight != null ? `${Number(item.effective_weight)}g` : '—'}
                </td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums text-navy">{item.qty}</td>
                <td className="px-2 py-2 text-right tabular-nums text-muted">{formatINR(item.making_charge || 0)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-muted">{formatINR(item.stone_charge || 0)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-muted">{formatINR(item.unit_price)}</td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums text-gold">{formatINR(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-sm">
        <span className="text-muted">
          {order?.coupon_code && `Coupon ${order.coupon_code} · `}
          {order?.is_gift && <span className="font-semibold text-gold">Gift order · </span>}
          Payment: {order?.payment_method?.toUpperCase()}
        </span>
        <span className="font-display text-lg font-semibold text-gold">
          {formatINR(order?.final_total ?? order?.total)}
        </span>
      </div>
      {order?.is_gift && order?.gift_note && (
        <p className="mt-2 rounded border border-gold/25 bg-ivory-3 px-2 py-1.5 text-[11px] text-navy">
          <span className="font-semibold">Gift note:</span> {order.gift_note}
        </p>
      )}
    </CompactPanel>
  )
}