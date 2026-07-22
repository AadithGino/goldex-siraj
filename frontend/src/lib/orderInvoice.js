/**
 * Printable / downloadable order invoice (browser print → PDF).
 * Layout inspired by UAE jewellery tax invoices: header, ship-to, line items,
 * payment stamp, company seal, totals, QR, disclaimer.
 */
import { toast } from 'sonner'
import { formatAED } from '@/lib/pricing'
import { formatDateSafe } from '@/lib/date'
import {
  STORE_BRAND,
  STORE_LEGAL_NAME_EN,
  STORE_LEGAL_NAME_AR,
  STORE_EMAIL,
  STORE_COMPLIANCE_EMAIL,
} from '@/lib/storeIdentity'

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function money(amount) {
  return esc(formatAED(amount))
}

function addrLines(addr = {}) {
  return [
    addr.recipient_name || addr.recipientName,
    addr.phone,
    addr.email,
    [addr.line1, addr.line2].filter(Boolean).join(', '),
    [addr.city, addr.state, addr.pincode || addr.postal_code].filter(Boolean).join(', '),
    addr.country || 'United Arab Emirates',
  ].filter(Boolean)
}

export function resolveInvoiceStamp(order) {
  const status = order?.payment_status
  if (status === 'paid') return { label: 'PAID', tone: 'paid' }
  if (status === 'refunded' || status === 'partially_refunded') return { label: 'REFUNDED', tone: 'muted' }
  if (order?.payment_method === 'cod' || status === 'cod_pending') {
    return { label: 'PAYMENT REQUIRED', tone: 'due' }
  }
  if (status === 'pending') return { label: 'PAYMENT REQUIRED', tone: 'due' }
  return { label: 'PAYMENT REQUIRED', tone: 'due' }
}

function buildCompanySeal({ legalName, sealLogoUrl, brand }) {
  const top = String(legalName || 'THE GOLDEX JEWELLERY L.L.C').toUpperCase()
  const bottom = 'DUBAI · UAE'
  // SVG circular stamp — full circle, no CSS clipping
  return `
  <svg class="seal-svg" viewBox="0 0 200 200" width="148" height="148" role="img" aria-label="${esc(brand)} official seal">
    <defs>
      <path id="seal-top" d="M 28,100 A 72,72 0 0 1 172,100" fill="none" />
      <path id="seal-bottom" d="M 172,100 A 72,72 0 0 1 28,100" fill="none" />
    </defs>
    <circle cx="100" cy="100" r="96" fill="none" stroke="#c9a227" stroke-width="3" />
    <circle cx="100" cy="100" r="90" fill="none" stroke="#c9a227" stroke-width="1.5" />
    <circle cx="100" cy="100" r="52" fill="none" stroke="#c9a227" stroke-width="1.5" />
    <text fill="#c9a227" font-size="11" font-weight="700" letter-spacing="1.5" font-family="Helvetica, Arial, sans-serif">
      <textPath href="#seal-top" startOffset="50%" text-anchor="middle">${esc(top)}</textPath>
    </text>
    <text fill="#c9a227" font-size="11" font-weight="700" letter-spacing="2" font-family="Helvetica, Arial, sans-serif">
      <textPath href="#seal-bottom" startOffset="50%" text-anchor="middle">${esc(bottom)}</textPath>
    </text>
    <image href="${esc(sealLogoUrl)}" x="68" y="68" width="64" height="64" preserveAspectRatio="xMidYMid meet" />
  </svg>`
}

function paymentMethodLabels(order) {
  const tags = []
  if (order.payment_method === 'cod') tags.push('#Cash on Delivery')
  if (order.payment_method === 'manual') tags.push('#Manual bank / card transfer')
  if (order.payment_mode === 'cash') tags.push('#Cash')
  if (order.payment_mode === 'bank_transfer') tags.push('#Bank transfer')
  if (order.payment_mode === 'card') tags.push('#Card')
  if (!tags.length) tags.push('#Payment pending')
  return tags
}

function resolveStore(store = {}) {
  const address = store.address && typeof store.address === 'object' ? store.address : {}
  const addressLine = [address.line1, address.city, address.country || 'United Arab Emirates']
    .filter(Boolean)
    .join(', ')
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : ''
  // Prefer store setting; otherwise the real Goldex public assets (absolute for print popup).
  const configuredLogo = store.logo_url ? String(store.logo_url).trim() : ''
  const markUrl = configuredLogo
    || (origin ? `${origin}/GOLDEX2.png` : '/GOLDEX2.png')
  const wordmarkUrl = origin ? `${origin}/GOLDEX2wordmark.png` : '/GOLDEX2wordmark.png'
  return {
    brand: store.store_name || STORE_BRAND,
    legalName: store.legal_name || STORE_LEGAL_NAME_EN,
    legalNameAr: STORE_LEGAL_NAME_AR,
    email: store.support_email || STORE_EMAIL,
    phone: store.support_phone || store.whatsapp_number || '',
    location: addressLine || 'Dubai, United Arab Emirates',
    /** Header uses wordmark only (or configured store logo). Seal uses mark. */
    headerLogoUrl: configuredLogo || wordmarkUrl,
    sealLogoUrl: markUrl,
    complianceEmail: STORE_COMPLIANCE_EMAIL,
  }
}

/**
 * @param {object} order — adapted admin or customer order
 * @param {{ store?: object, autoPrint?: boolean }} [options]
 */
export function openOrderInvoice(order, { store, autoPrint = false } = {}) {
  if (!order) {
    toast.error('Order not available')
    return
  }

  const identity = resolveStore(store)
  const items = order.order_items || order.items || []
  const customer = order.customers || {}
  const shipTo = order.ship_to || {}
  const collection = order.payment_collection || {}
  const stamp = resolveInvoiceStamp(order)
  const isPaid = order.payment_status === 'paid'
  const docTitle = isPaid && order.invoice_number ? 'INVOICE' : 'ORDER INVOICE'
  const displayTotal = isPaid && order.final_total != null
    ? order.final_total
    : (order.final_total ?? order.estimated_total ?? order.total ?? order.amount_due ?? 0)
  const paidByCustomer = isPaid
    ? (collection.amount ?? order.final_total ?? displayTotal)
    : 0
  const orderDate = formatDateSafe(
    order.paid_at || order.finalized_at || order.placed_at,
    'EEEE, dd MMM yyyy hh:mm a',
  )
  const shipLines = addrLines({
    ...shipTo,
    email: shipTo.email || customer.email,
    phone: shipTo.phone || customer.phone,
    recipient_name: shipTo.recipient_name || shipTo.recipientName || customer.full_name,
  })
  const qrPayload = [
    identity.brand,
    order.order_number,
    order.invoice_number || '',
    String(displayTotal),
  ].filter(Boolean).join('|')
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=8B6914&bgcolor=FFFFFF&data=${encodeURIComponent(qrPayload)}`
  const maskedRef = collection.transaction_ref_masked
    || (collection.transaction_ref ? `••••${String(collection.transaction_ref).slice(-4)}` : '')

  const itemRows = items.map((item) => {
    const weight = item.effective_weight ?? item.weight_grams
    const img = item.image_url
      ? `<img class="thumb" src="${esc(item.image_url)}" alt="" />`
      : `<div class="thumb placeholder"></div>`
    return `
      <tr>
        <td class="item-cell">
          <div class="item-row">
            ${img}
            <div>
              <div class="item-name">${esc(item.product_name)}</div>
              ${item.sku ? `<div class="muted">SKU: ${esc(item.sku)}</div>` : ''}
              ${item.variant_label ? `<div class="muted">${esc(item.variant_label)}</div>` : ''}
              ${item.purity ? `<div class="muted">Purity: ${esc(String(item.purity).toUpperCase())}</div>` : ''}
              ${weight != null ? `<div class="muted">Weight: ${esc(Number(weight))} GRAMS</div>` : ''}
              ${item.customization_request ? `<div class="muted">Custom: ${esc(item.customization_request)}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="num">${esc(item.qty)}</td>
        <td class="num">${money(item.unit_price)}</td>
        <td class="num"><b>${money(item.line_total)}</b></td>
      </tr>`
  }).join('')

  const tb = order.tax_breakdown || {}
  const totalsBits = [
    `<div class="t-row"><span>Subtotal</span><span>${money(order.subtotal)}</span></div>`,
    order.making_charge_total > 0
      ? `<div class="t-row"><span>Making charge</span><span>${money(order.making_charge_total)}</span></div>`
      : '',
    (order.coupon_code || order.discount_amount > 0)
      ? `<div class="t-row"><span>Discount${order.coupon_code ? ` (${esc(order.coupon_code)})` : ''}</span><span class="neg">− ${money(order.discount_amount || 0)}</span></div>`
      : '',
    `<div class="t-row"><span>Shipping</span><span>${order.shipping_fee > 0 ? money(order.shipping_fee) : money(0)}</span></div>`,
    tb.standard_rated_total > 0
      ? `<div class="t-row muted"><span>Standard-rated</span><span>${money(tb.standard_rated_total)}</span></div>`
      : '',
    tb.zero_rated_total > 0
      ? `<div class="t-row muted"><span>Zero-rated (24KT)</span><span>${money(tb.zero_rated_total)}</span></div>`
      : '',
    `<div class="t-row"><span>VAT</span><span>${money(order.tax_amount || 0)}</span></div>`,
    order.wallet_applied > 0
      ? `<div class="t-row"><span>Wallet</span><span class="neg">− ${money(order.wallet_applied)}</span></div>`
      : '',
    `<div class="t-row grand"><span>Grand total</span><span>${money(displayTotal)}</span></div>`,
    `<div class="t-row"><span>Paid by customer</span><span>${money(paidByCustomer)}</span></div>`,
    !isPaid && order.amount_due != null
      ? `<div class="t-row"><span>Amount due</span><span>${money(order.amount_due)}</span></div>`
      : '',
  ].filter(Boolean).join('')

  const logoBlock = `
    <img class="logo-wordmark" src="${esc(identity.headerLogoUrl)}" alt="${esc(identity.brand)}" />`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(docTitle)} ${esc(order.invoice_number || order.order_number)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 28px;
      color: #1a1a2e;
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 12px;
      background: #fff;
    }
    .sheet { position: relative; max-width: 820px; margin: 0 auto; }
    .toolbar {
      display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 16px;
    }
    .toolbar button {
      border: 1px solid #c9a227; background: #fff8e7; color: #1a1a2e;
      padding: 8px 14px; border-radius: 8px; font-weight: 600; cursor: pointer;
    }
    .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
    .brand { display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; }
    .logo-wordmark { height: 64px; width: auto; max-width: 320px; object-fit: contain; display: block; }
    .seal-wrap { margin-top: 10px; margin-bottom: 8px; }
    .seal-svg { display: block; overflow: visible; }
    .invoice-head { text-align: right; }
    .invoice-head h1 {
      margin: 0; font-size: 42px; font-weight: 800; color: #9aa0a6; letter-spacing: 1px;
    }
    .company { margin-top: 8px; color: #444; line-height: 1.45; }
    .company strong { color: #1a1a2e; }
    hr.rule { border: none; border-top: 1px solid #ddd; margin: 18px 0; }
    .meta-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; }
    .label { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #666; margin-bottom: 6px; }
    .ship p { margin: 0 0 2px; }
    .amount-box { text-align: right; }
    .amount-box .amt { font-size: 22px; font-weight: 800; color: #1a1a2e; }
    .amount-box .row { margin-top: 4px; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 18px; }
    table.items th {
      text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
      padding: 10px 8px; border: 1px solid #e5e5e5; background: #faf7f0; color: #555;
    }
    table.items th.num, table.items td.num { text-align: right; }
    table.items td { padding: 10px 8px; border: 1px solid #e5e5e5; vertical-align: top; }
    .item-row { display: flex; gap: 10px; align-items: flex-start; }
    .thumb { width: 52px; height: 52px; object-fit: cover; border-radius: 6px; border: 1px solid #eee; }
    .thumb.placeholder { background: #f3f0ea; }
    .item-name { font-weight: 700; color: #1a1a2e; margin-bottom: 2px; }
    .muted { color: #777; font-size: 11px; }
    .neg { color: #b3261e; }
    .stamp {
      position: absolute; top: 46%; left: 50%;
      transform: translate(-50%, -50%) rotate(-18deg);
      border: 3px solid #c41e1e; color: #c41e1e;
      font-size: 26px; font-weight: 900; letter-spacing: 2px;
      padding: 10px 22px; border-radius: 10px; opacity: .88;
      pointer-events: none; white-space: nowrap; z-index: 5;
    }
    .stamp.paid { border-color: #2f7d4f; color: #2f7d4f; }
    .stamp.muted { border-color: #888; color: #666; }
    .lower { display: grid; grid-template-columns: 1fr 280px; gap: 24px; margin-top: 18px; align-items: start; }
    .totals { border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; }
    .t-row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 12px; border-bottom: 1px solid #eee; }
    .t-row:last-child { border-bottom: none; }
    .t-row.grand { background: #e8c547; font-weight: 800; font-size: 14px; }
    .t-row.muted { color: #777; font-size: 11px; }
    .pay-info { margin-top: 20px; }
    .pay-tags { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
    .tag {
      display: inline-block; border: 1px solid #ddd; border-radius: 999px;
      padding: 4px 10px; font-size: 11px; color: #555; background: #fafafa;
    }
    .footer-grid {
      display: grid; grid-template-columns: 160px 1fr; gap: 16px;
      margin-top: 28px; align-items: center;
    }
    .qr { width: 140px; height: 140px; border: 1px solid #eee; padding: 4px; background: #fff; }
    .disclaimer { color: #666; font-size: 11px; line-height: 1.5; }
    @media print {
      body { padding: 0; }
      .toolbar { display: none !important; }
      .stamp { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .t-row.grand { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="toolbar">
      <button type="button" onclick="window.print()">Download / Print PDF</button>
      <button type="button" onclick="window.close()">Close</button>
    </div>

    <div class="stamp ${esc(stamp.tone)}">${esc(stamp.label)}</div>

    <div class="header">
      <div class="brand">${logoBlock}</div>
      <div class="invoice-head">
        <h1>${esc(docTitle)}</h1>
        <div class="company">
          <strong>${esc(identity.legalName)}</strong><br/>
          ${esc(identity.location)}<br/>
          ${identity.email ? `${esc(identity.email)}<br/>` : ''}
          ${identity.phone ? esc(identity.phone) : ''}
        </div>
      </div>
    </div>

    <hr class="rule" />

    <div class="meta-grid">
      <div class="ship">
        <div class="label">Shipping address</div>
        ${shipLines.map((line) => `<p>${esc(line)}</p>`).join('')}
      </div>
      <div class="amount-box">
        <div class="label">Amount</div>
        <div class="amt">${money(displayTotal)}</div>
        <div class="row"><b>Order Number:</b> # ${esc(order.order_number)}</div>
        ${order.invoice_number ? `<div class="row"><b>Invoice Number:</b> ${esc(order.invoice_number)}</div>` : ''}
        <div class="row"><b>Order Date:</b> ${esc(orderDate)}</div>
        <div class="row"><b>Status:</b> ${esc(order.status)}</div>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th>Items</th>
          <th class="num">Qty</th>
          <th class="num">Price</th>
          <th class="num">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemRows || '<tr><td colspan="4">No items</td></tr>'}</tbody>
    </table>

    <div class="lower">
      <div>
        <div class="seal-wrap">
          ${buildCompanySeal({
            legalName: identity.legalName,
            sealLogoUrl: identity.sealLogoUrl,
            brand: identity.brand,
          })}
        </div>
        <div class="pay-info">
          <div class="label">Payment information</div>
          ${shipLines.slice(0, 3).map((line) => `<div>${esc(line)}</div>`).join('')}
          <div class="pay-tags">
            ${paymentMethodLabels(order).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
            ${maskedRef ? `<span class="tag">Ref ${esc(maskedRef)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="totals">${totalsBits}</div>
    </div>

    <div class="footer-grid">
      <img class="qr" src="${esc(qrUrl)}" alt="Order QR" />
      <div class="disclaimer">
        Our jewellery is real gold sold by piece (not per gram). A small weight variation of about 1–3% may apply.
        Thank you for your purchase with ${esc(identity.brand)}.
        For support contact ${esc(identity.email)}${identity.complianceEmail ? ` · ${esc(identity.complianceEmail)}` : ''}.
      </div>
    </div>
  </div>
  ${autoPrint ? '<script>window.onload = function () { setTimeout(function () { window.print(); }, 350); };</script>' : ''}
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    toast.error('Popup blocked. Allow popups for this site and try again.')
    return
  }
  win.document.write(html)
  win.document.close()
}
