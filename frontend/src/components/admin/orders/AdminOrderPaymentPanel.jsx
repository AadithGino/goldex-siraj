import { formatAED } from '@/lib/pricing'
import { CompactPanel } from '@/components/shared/CompactPanel'
import { formatDateSafe } from '@/lib/date'
import {
  getPaymentModeLabel,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/lib/constants'

function TableRow({ label, value, mono, accent }) {
  if (value == null || value === '') return null
  return (
    <tr className="border-b border-line/60 last:border-0">
      <td className="py-1.5 pr-3 align-top text-xs text-muted">{label}</td>
      <td
        className={[
          'py-1.5 text-right align-top text-xs',
          mono ? 'break-all font-mono text-[10px] text-navy' : 'text-navy',
          accent ? 'font-semibold text-gold' : '',
        ].join(' ')}
      >
        {value}
      </td>
    </tr>
  )
}

export function AdminOrderPaymentPanel({ order }) {
  if (!order) return null
  const collection = order.payment_collection

  const hasBreakdown =
    order.subtotal != null ||
    order.discount_amount > 0 ||
    order.shipping_fee > 0 ||
    order.tax_amount > 0

  return (
    <CompactPanel title="Payment">
      {hasBreakdown && (
        <table className="mb-2 w-full border-b border-line pb-2">
          <tbody>
            <TableRow label="Subtotal" value={order.subtotal != null ? formatAED(order.subtotal) : null} />
            <TableRow label="Making" value={order.making_charge_total > 0 ? formatAED(order.making_charge_total) : null} />
            {(order.coupon_code || order.discount_amount > 0) && (
              <tr className="border-b border-line/60">
                <td className="py-1.5 pr-3 text-xs text-muted">
                  Coupon{order.coupon_code ? ` (${order.coupon_code})` : ''}
                </td>
                <td className="py-1.5 text-right text-xs font-medium text-[#b3261e]">
                  − {formatAED(order.discount_amount || 0)}
                </td>
              </tr>
            )}
            <TableRow
              label="Shipping"
              value={order.shipping_fee > 0 ? formatAED(order.shipping_fee) : (order.shipping_fee === 0 ? 'Free' : null)}
            />
            <TableRow label="VAT" value={order.tax_amount > 0 ? formatAED(order.tax_amount) : null} />
            <TableRow
              label="Wallet"
              value={order.wallet_applied > 0 ? `− ${formatAED(order.wallet_applied)}` : null}
            />
            <TableRow label="Locked total" value={order.final_total != null ? formatAED(order.final_total) : (order.total != null ? formatAED(order.total) : null)} accent />
            <TableRow label="Estimated total (COD)" value={order.pricing_mode === 'cod_delivery' && order.estimated_total != null ? formatAED(order.estimated_total) : null} />
          </tbody>
        </table>
      )}

      <table className="w-full">
        <tbody>
          {order.pricing_mode === 'cod_delivery' && order.payment_status !== 'paid' && (
            <tr className="border-b border-line/60">
              <td colSpan={2} className="rounded bg-gold/10 px-2 py-1.5 text-[11px] text-navy">
                <strong>Estimated price.</strong> Final payable amount may vary based on gold rate at delivery.
              </td>
            </tr>
          )}
          <TableRow label="Method" value={PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method} />
          <TableRow label="Mode" value={getPaymentModeLabel(order.payment_mode)} />
          <TableRow label="Status" value={PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status} />
          <TableRow
            label="Pricing"
            value={order.pricing_mode === 'cod_delivery' ? 'Estimated until COD handover' : 'Locked at order placement'}
          />
          <TableRow label="Paid at" value={formatDateSafe(order.paid_at, 'dd MMM yyyy HH:mm', null)} />
          <TableRow label="Finalized at" value={formatDateSafe(order.finalized_at, 'dd MMM yyyy HH:mm', null)} />
          <TableRow label="Expected" value={collection?.expected_amount != null ? formatAED(collection.expected_amount) : null} />
          <TableRow label="Collected" value={collection?.amount != null ? formatAED(collection.amount) : null} />
          <TableRow label="Due" value={order.amount_due != null ? formatAED(order.amount_due) : null} />
          <TableRow label="Transaction ref" value={collection?.transaction_ref} mono />
          <TableRow
            label="Collected by"
            value={
              collection?.collected_by?.full_name
              || collection?.collected_by?.email
              || (typeof collection?.collected_by === 'string' ? collection.collected_by : null)
            }
          />
        </tbody>
      </table>
    </CompactPanel>
  )
}
