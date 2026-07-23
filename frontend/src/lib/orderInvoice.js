/**
 * Printable / downloadable order invoice (browser print → PDF).
 * Supports English (LTR) and Arabic (RTL) based on `lang`.
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
  getStoreLegalName,
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

function normalizeLang(lang) {
  return String(lang || '').startsWith('ar') ? 'ar' : 'en'
}

const COPY = {
  en: {
    invoice: 'INVOICE',
    orderInvoice: 'ORDER INVOICE',
    downloadPrint: 'Download / Print PDF',
    close: 'Close',
    shippingAddress: 'Shipping address',
    amount: 'Amount',
    orderNumber: 'Order Number',
    invoiceNumber: 'Invoice Number',
    orderDate: 'Order Date',
    status: 'Status',
    items: 'Items',
    qty: 'Qty',
    price: 'Price',
    lineSubtotal: 'Subtotal',
    sku: 'SKU',
    purity: 'Purity',
    weight: 'Weight',
    grams: 'GRAMS',
    custom: 'Custom',
    noItems: 'No items',
    paymentInformation: 'Payment information',
    subtotal: 'Subtotal',
    makingCharge: 'Making charge',
    discount: 'Discount',
    shipping: 'Shipping',
    standardRated: 'Standard-rated',
    zeroRated: 'Zero-rated (24KT)',
    vat: 'VAT',
    wallet: 'Wallet',
    grandTotal: 'Grand total',
    paidByCustomer: 'Paid by customer',
    amountDue: 'Amount due',
    ref: 'Ref',
    location: 'Dubai, United Arab Emirates',
    sealBottom: 'DUBAI · UAE',
    stampPaid: 'PAID',
    stampRefunded: 'REFUNDED',
    stampDue: 'PAYMENT REQUIRED',
    payCod: '#Cash on Delivery',
    payManual: '#Manual bank / card transfer',
    payCash: '#Cash',
    payBank: '#Bank transfer',
    payCard: '#Card',
    payPending: '#Payment pending',
    disclaimer:
      'Our jewellery is real gold sold by piece (not per gram). A small weight variation of about 1–3% may apply. Thank you for your purchase with {brand}. For support contact {email}{compliance}.',
    popupBlocked: 'Popup blocked. Allow popups for this site and try again.',
    orderMissing: 'Order not available',
    statusLabels: {
      placed: 'Placed',
      confirmed: 'Confirmed',
      processing: 'Processing',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      returned: 'Returned',
      partially_returned: 'Partially returned',
    },
  },
  ar: {
    invoice: 'فاتورة',
    orderInvoice: 'فاتورة الطلب',
    downloadPrint: 'تنزيل / طباعة PDF',
    close: 'إغلاق',
    shippingAddress: 'عنوان الشحن',
    amount: 'المبلغ',
    orderNumber: 'رقم الطلب',
    invoiceNumber: 'رقم الفاتورة',
    orderDate: 'تاريخ الطلب',
    status: 'الحالة',
    items: 'المنتجات',
    qty: 'الكمية',
    price: 'السعر',
    lineSubtotal: 'المجموع',
    sku: 'رمز المنتج',
    purity: 'العيار',
    weight: 'الوزن',
    grams: 'جرام',
    custom: 'تخصيص',
    noItems: 'لا توجد منتجات',
    paymentInformation: 'معلومات الدفع',
    subtotal: 'المجموع الفرعي',
    makingCharge: 'أجور التصنيع',
    discount: 'الخصم',
    shipping: 'الشحن',
    standardRated: 'خاضع للضريبة',
    zeroRated: 'معدل صفري (٢٤ قيراط)',
    vat: 'ض.ق.م',
    wallet: 'المحفظة',
    grandTotal: 'الإجمالي',
    paidByCustomer: 'المدفوع من العميل',
    amountDue: 'المبلغ المستحق',
    ref: 'مرجع',
    location: 'دبي، الإمارات العربية المتحدة',
    sealBottom: 'دبي · الإمارات',
    stampPaid: 'مدفوع',
    stampRefunded: 'مسترد',
    stampDue: 'الدفع مطلوب',
    payCod: '#الدفع عند الاستلام',
    payManual: '#تحويل بنكي / بطاقة يدوي',
    payCash: '#نقداً',
    payBank: '#تحويل بنكي',
    payCard: '#بطاقة',
    payPending: '#الدفع معلّق',
    disclaimer:
      'مجوهراتنا من الذهب الحقيقي وتُباع بالقطعة (وليس بالجرام). قد يحدث تفاوت بسيط في الوزن بنحو ١–٣٪. شكراً لشرائك من {brand}. للدعم تواصل عبر {email}{compliance}.',
    popupBlocked: 'تم حظر النافذة المنبثقة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.',
    orderMissing: 'الطلب غير متاح',
    statusLabels: {
      placed: 'مُقدَّم',
      confirmed: 'مُؤكَّد',
      processing: 'قيد المعالجة',
      shipped: 'تم الشحن',
      delivered: 'تم التوصيل',
      cancelled: 'ملغى',
      returned: 'مُرتجَع',
      partially_returned: 'مرتجع جزئياً',
    },
  },
}

function addrLines(addr = {}, copy) {
  return [
    addr.recipient_name || addr.recipientName,
    addr.phone,
    addr.email,
    [addr.line1, addr.line2].filter(Boolean).join(', '),
    [addr.city, addr.state, addr.pincode || addr.postal_code].filter(Boolean).join(', '),
    addr.country || copy.location,
  ].filter(Boolean)
}

export function resolveInvoiceStamp(order, lang = 'en') {
  const copy = COPY[normalizeLang(lang)]
  const status = order?.payment_status
  if (status === 'paid') return { label: copy.stampPaid, tone: 'paid' }
  if (status === 'refunded' || status === 'partially_refunded') {
    return { label: copy.stampRefunded, tone: 'muted' }
  }
  return { label: copy.stampDue, tone: 'due' }
}

function buildCompanySeal({ legalName, sealLogoUrl, brand, sealBottom }) {
  const top = String(legalName || STORE_LEGAL_NAME_EN)
  const bottom = sealBottom || 'DUBAI · UAE'
  return `
  <svg class="seal-svg" viewBox="0 0 200 200" width="148" height="148" role="img" aria-label="${esc(brand)} official seal">
    <defs>
      <path id="seal-top" d="M 28,100 A 72,72 0 0 1 172,100" fill="none" />
      <path id="seal-bottom" d="M 172,100 A 72,72 0 0 1 28,100" fill="none" />
    </defs>
    <circle cx="100" cy="100" r="96" fill="none" stroke="#c9a227" stroke-width="3" />
    <circle cx="100" cy="100" r="90" fill="none" stroke="#c9a227" stroke-width="1.5" />
    <circle cx="100" cy="100" r="52" fill="none" stroke="#c9a227" stroke-width="1.5" />
    <text fill="#c9a227" font-size="10" font-weight="700" letter-spacing="1" font-family="Helvetica, Arial, sans-serif">
      <textPath href="#seal-top" startOffset="50%" text-anchor="middle">${esc(top)}</textPath>
    </text>
    <text fill="#c9a227" font-size="11" font-weight="700" letter-spacing="1.5" font-family="Helvetica, Arial, sans-serif">
      <textPath href="#seal-bottom" startOffset="50%" text-anchor="middle">${esc(bottom)}</textPath>
    </text>
    <image href="${esc(sealLogoUrl)}" x="68" y="68" width="64" height="64" preserveAspectRatio="xMidYMid meet" />
  </svg>`
}

function paymentMethodLabels(order, copy) {
  const tags = []
  if (order.payment_method === 'cod') tags.push(copy.payCod)
  if (order.payment_method === 'manual') tags.push(copy.payManual)
  if (order.payment_mode === 'cash') tags.push(copy.payCash)
  if (order.payment_mode === 'bank_transfer') tags.push(copy.payBank)
  if (order.payment_mode === 'card') tags.push(copy.payCard)
  if (!tags.length) tags.push(copy.payPending)
  return tags
}

function resolveStore(store = {}, lang = 'en') {
  const address = store.address && typeof store.address === 'object' ? store.address : {}
  const addressLine = [address.line1, address.city, address.country]
    .filter(Boolean)
    .join(', ')
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : ''
  const configuredLogo = store.logo_url ? String(store.logo_url).trim() : ''
  const markUrl = configuredLogo
    || (origin ? `${origin}/GOLDEX2.png` : '/GOLDEX2.png')
  const wordmarkUrl = origin ? `${origin}/GOLDEX2wordmark.png` : '/GOLDEX2wordmark.png'
  const copy = COPY[normalizeLang(lang)]
  return {
    brand: store.store_name || STORE_BRAND,
    legalName: store.legal_name || getStoreLegalName(normalizeLang(lang)),
    legalNameEn: STORE_LEGAL_NAME_EN,
    legalNameAr: STORE_LEGAL_NAME_AR,
    email: store.support_email || STORE_EMAIL,
    phone: store.support_phone || store.whatsapp_number || '',
    location: addressLine || copy.location,
    headerLogoUrl: configuredLogo || wordmarkUrl,
    sealLogoUrl: markUrl,
    complianceEmail: STORE_COMPLIANCE_EMAIL,
  }
}

/**
 * @param {object} order
 * @param {{ store?: object, autoPrint?: boolean, lang?: string }} [options]
 */
export function openOrderInvoice(order, { store, autoPrint = false, lang } = {}) {
  const locale = normalizeLang(lang)
  const copy = COPY[locale]
  const rtl = locale === 'ar'

  if (!order) {
    toast.error(copy.orderMissing)
    return
  }

  const identity = resolveStore(store, locale)
  const items = order.order_items || order.items || []
  const customer = order.customers || {}
  const shipTo = order.ship_to || {}
  const collection = order.payment_collection || {}
  const stamp = resolveInvoiceStamp(order, locale)
  const isPaid = order.payment_status === 'paid'
  const docTitle = isPaid && order.invoice_number ? copy.invoice : copy.orderInvoice
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
  }, copy)
  const statusLabel = copy.statusLabels[order.status] || order.status
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
    const name = (rtl && item.product_name_ar) ? item.product_name_ar : item.product_name
    const variant = (rtl && item.variant_label_ar) ? item.variant_label_ar : item.variant_label
    const img = item.image_url
      ? `<img class="thumb" src="${esc(item.image_url)}" alt="" />`
      : `<div class="thumb placeholder"></div>`
    return `
      <tr>
        <td class="item-cell">
          <div class="item-row">
            ${img}
            <div>
              <div class="item-name">${esc(name)}</div>
              ${item.sku ? `<div class="muted">${esc(copy.sku)}: ${esc(item.sku)}</div>` : ''}
              ${variant ? `<div class="muted">${esc(variant)}</div>` : ''}
              ${item.purity ? `<div class="muted">${esc(copy.purity)}: ${esc(String(item.purity).toUpperCase())}</div>` : ''}
              ${weight != null ? `<div class="muted">${esc(copy.weight)}: ${esc(Number(weight))} ${esc(copy.grams)}</div>` : ''}
              ${item.customization_request ? `<div class="muted">${esc(copy.custom)}: ${esc(item.customization_request)}</div>` : ''}
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
    `<div class="t-row"><span>${esc(copy.subtotal)}</span><span>${money(order.subtotal)}</span></div>`,
    order.making_charge_total > 0
      ? `<div class="t-row"><span>${esc(copy.makingCharge)}</span><span>${money(order.making_charge_total)}</span></div>`
      : '',
    (order.coupon_code || order.discount_amount > 0)
      ? `<div class="t-row"><span>${esc(copy.discount)}${order.coupon_code ? ` (${esc(order.coupon_code)})` : ''}</span><span class="neg">− ${money(order.discount_amount || 0)}</span></div>`
      : '',
    `<div class="t-row"><span>${esc(copy.shipping)}</span><span>${order.shipping_fee > 0 ? money(order.shipping_fee) : money(0)}</span></div>`,
    tb.standard_rated_total > 0
      ? `<div class="t-row muted"><span>${esc(copy.standardRated)}</span><span>${money(tb.standard_rated_total)}</span></div>`
      : '',
    tb.zero_rated_total > 0
      ? `<div class="t-row muted"><span>${esc(copy.zeroRated)}</span><span>${money(tb.zero_rated_total)}</span></div>`
      : '',
    `<div class="t-row"><span>${esc(copy.vat)}</span><span>${money(order.tax_amount || 0)}</span></div>`,
    order.wallet_applied > 0
      ? `<div class="t-row"><span>${esc(copy.wallet)}</span><span class="neg">− ${money(order.wallet_applied)}</span></div>`
      : '',
    `<div class="t-row grand"><span>${esc(copy.grandTotal)}</span><span>${money(displayTotal)}</span></div>`,
    `<div class="t-row"><span>${esc(copy.paidByCustomer)}</span><span>${money(paidByCustomer)}</span></div>`,
    !isPaid && order.amount_due != null
      ? `<div class="t-row"><span>${esc(copy.amountDue)}</span><span>${money(order.amount_due)}</span></div>`
      : '',
  ].filter(Boolean).join('')

  const disclaimer = copy.disclaimer
    .replace('{brand}', identity.brand)
    .replace('{email}', identity.email || '')
    .replace('{compliance}', identity.complianceEmail ? ` · ${identity.complianceEmail}` : '')

  const companyName = rtl
    ? (identity.legalNameAr || identity.legalName)
    : (identity.legalName || identity.legalNameEn)

  const html = `<!DOCTYPE html>
<html lang="${rtl ? 'ar' : 'en'}" dir="${rtl ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <title>${esc(docTitle)} ${esc(order.invoice_number || order.order_number)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 28px;
      color: #1a1a2e;
      font-family: ${rtl
    ? '"Segoe UI", Tahoma, "Noto Naskh Arabic", "Helvetica Neue", Arial, sans-serif'
    : '"Helvetica Neue", Helvetica, Arial, sans-serif'};
      font-size: 12px;
      background: #fff;
      direction: ${rtl ? 'rtl' : 'ltr'};
    }
    .sheet { position: relative; max-width: 820px; margin: 0 auto; }
    .toolbar {
      display: flex; gap: 8px; justify-content: ${rtl ? 'flex-start' : 'flex-end'}; margin-bottom: 16px;
    }
    .toolbar button {
      border: 1px solid #c9a227; background: #fff8e7; color: #1a1a2e;
      padding: 8px 14px; border-radius: 8px; font-weight: 600; cursor: pointer;
    }
    .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
    .brand { display: flex; flex-direction: column; align-items: ${rtl ? 'flex-end' : 'flex-start'}; }
    .logo-wordmark { height: 64px; width: auto; max-width: 320px; object-fit: contain; display: block; }
    .seal-wrap { margin-top: 10px; margin-bottom: 8px; }
    .seal-svg { display: block; overflow: visible; }
    .invoice-head { text-align: ${rtl ? 'left' : 'right'}; }
    .invoice-head h1 {
      margin: 0; font-size: ${rtl ? '36px' : '42px'}; font-weight: 800; color: #9aa0a6; letter-spacing: ${rtl ? '0' : '1px'};
    }
    .company { margin-top: 8px; color: #444; line-height: 1.45; }
    .company strong { color: #1a1a2e; }
    hr.rule { border: none; border-top: 1px solid #ddd; margin: 18px 0; }
    .meta-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; }
    .label { font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: ${rtl ? 'none' : 'uppercase'}; color: #666; margin-bottom: 6px; }
    .ship p { margin: 0 0 2px; }
    .amount-box { text-align: ${rtl ? 'left' : 'right'}; }
    .amount-box .amt { font-size: 22px; font-weight: 800; color: #1a1a2e; }
    .amount-box .row { margin-top: 4px; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 18px; }
    table.items th {
      text-align: ${rtl ? 'right' : 'left'}; font-size: 11px; text-transform: ${rtl ? 'none' : 'uppercase'}; letter-spacing: .04em;
      padding: 10px 8px; border: 1px solid #e5e5e5; background: #faf7f0; color: #555;
    }
    table.items th.num, table.items td.num { text-align: ${rtl ? 'left' : 'right'}; }
    table.items td { padding: 10px 8px; border: 1px solid #e5e5e5; vertical-align: top; }
    .item-row { display: flex; gap: 10px; align-items: flex-start; }
    .thumb { width: 52px; height: 52px; object-fit: cover; border-radius: 6px; border: 1px solid #eee; }
    .thumb.placeholder { background: #f3f0ea; }
    .item-name { font-weight: 700; color: #1a1a2e; margin-bottom: 2px; }
    .muted { color: #777; font-size: 11px; }
    .neg { color: #b3261e; }
    .stamp {
      position: absolute; top: 46%; left: 50%;
      transform: translate(-50%, -50%) rotate(${rtl ? '18deg' : '-18deg'});
      border: 3px solid #c41e1e; color: #c41e1e;
      font-size: ${rtl ? '22px' : '26px'}; font-weight: 900; letter-spacing: ${rtl ? '0' : '2px'};
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
    .disclaimer { color: #666; font-size: 11px; line-height: 1.7; }
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
      <button type="button" onclick="window.print()">${esc(copy.downloadPrint)}</button>
      <button type="button" onclick="window.close()">${esc(copy.close)}</button>
    </div>

    <div class="stamp ${esc(stamp.tone)}">${esc(stamp.label)}</div>

    <div class="header">
      <div class="brand">
        <img class="logo-wordmark" src="${esc(identity.headerLogoUrl)}" alt="${esc(identity.brand)}" />
      </div>
      <div class="invoice-head">
        <h1>${esc(docTitle)}</h1>
        <div class="company">
          <strong>${esc(companyName)}</strong><br/>
          ${esc(identity.location)}<br/>
          ${identity.email ? `${esc(identity.email)}<br/>` : ''}
          ${identity.phone ? esc(identity.phone) : ''}
        </div>
      </div>
    </div>

    <hr class="rule" />

    <div class="meta-grid">
      <div class="ship">
        <div class="label">${esc(copy.shippingAddress)}</div>
        ${shipLines.map((line) => `<p>${esc(line)}</p>`).join('')}
      </div>
      <div class="amount-box">
        <div class="label">${esc(copy.amount)}</div>
        <div class="amt">${money(displayTotal)}</div>
        <div class="row"><b>${esc(copy.orderNumber)}:</b> # ${esc(order.order_number)}</div>
        ${order.invoice_number ? `<div class="row"><b>${esc(copy.invoiceNumber)}:</b> ${esc(order.invoice_number)}</div>` : ''}
        <div class="row"><b>${esc(copy.orderDate)}:</b> ${esc(orderDate)}</div>
        <div class="row"><b>${esc(copy.status)}:</b> ${esc(statusLabel)}</div>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th>${esc(copy.items)}</th>
          <th class="num">${esc(copy.qty)}</th>
          <th class="num">${esc(copy.price)}</th>
          <th class="num">${esc(copy.lineSubtotal)}</th>
        </tr>
      </thead>
      <tbody>${itemRows || `<tr><td colspan="4">${esc(copy.noItems)}</td></tr>`}</tbody>
    </table>

    <div class="lower">
      <div>
        <div class="seal-wrap">
          ${buildCompanySeal({
            legalName: companyName,
            sealLogoUrl: identity.sealLogoUrl,
            brand: identity.brand,
            sealBottom: copy.sealBottom,
          })}
        </div>
        <div class="pay-info">
          <div class="label">${esc(copy.paymentInformation)}</div>
          ${shipLines.slice(0, 3).map((line) => `<div>${esc(line)}</div>`).join('')}
          <div class="pay-tags">
            ${paymentMethodLabels(order, copy).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
            ${maskedRef ? `<span class="tag">${esc(copy.ref)} ${esc(maskedRef)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="totals">${totalsBits}</div>
    </div>

    <div class="footer-grid">
      <img class="qr" src="${esc(qrUrl)}" alt="QR" />
      <div class="disclaimer">${esc(disclaimer)}</div>
    </div>
  </div>
  ${autoPrint ? '<script>window.onload = function () { setTimeout(function () { window.print(); }, 350); };</script>' : ''}
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    toast.error(copy.popupBlocked)
    return
  }
  win.document.write(html)
  win.document.close()
}
