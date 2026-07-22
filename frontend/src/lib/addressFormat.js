/** UAE emirates for address forms — English values stored in DB; use getUaeEmirates(t) for display */
export const UAE_EMIRATES = [
  'Abu Dhabi',
  'Ajman',
  'Dubai',
  'Fujairah',
  'Ras Al Khaimah',
  'Sharjah',
  'Umm Al Quwain',
]

export { getUaeEmirates, getEmirateLabel } from '@/lib/i18nLabels'

export function normalizeUaePhone(input) {
  if (!input) return ''
  let d = String(input).replace(/\D/g, '')
  if (d.startsWith('971')) d = d.slice(3)
  if (d.startsWith('0')) d = d.slice(1)
  return d.slice(0, 9)
}

/** UAE mobiles are 9 digits starting with 5 (50/52/54/55/56/58…). */
export function isValidUaeMobile(input) {
  return /^5\d{8}$/.test(normalizeUaePhone(input))
}

export function formatPhoneUAE(phone) {
  if (!phone) return ''
  const d = normalizeUaePhone(phone)
  if (d.length < 9) return `+971 ${phone}`.trim()
  return `+971 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`
}

import i18n from '@/i18n'

/** Normalized address object (DB row or ship_to JSON) */
export function formatDubaiAddressLines(address = {}, t = i18n.t.bind(i18n)) {
  if (!address || (!address.line1 && !address.recipient_name)) return []

  const lines = []
  if (address.recipient_name) lines.push(address.recipient_name)
  const phone = address.phone ? formatPhoneUAE(address.phone) : null
  if (phone) lines.push(phone)

  const street = [address.line1, address.line2].filter(Boolean).join(', ')
  if (street) lines.push(street)

  const locality = [address.city, address.state].filter(Boolean).join(', ')
  if (locality) lines.push(`${locality}, ${t('common:countryUae')}`)

  if (address.pincode?.trim()) {
    const p = address.pincode.trim()
    lines.push(/^makani/i.test(p) || /^po\s*box/i.test(p) ? p : t('common:poBoxMakani', { value: p }))
  }

  if (address.latitude != null && address.longitude != null && address.latitude !== '' && address.longitude !== '') {
    lines.push(`GPS: ${address.latitude}, ${address.longitude}`)
  }

  return lines
}

export function formatDubaiAddressInline(address = {}) {
  return formatDubaiAddressLines(address).join(' · ')
}

/** Multi-line block for display & copy (Dubai courier format) */
export function formatDubaiAddressBlock(address = {}) {
  return formatDubaiAddressLines(address).join('\n')
}

export function formatFulfillmentCopyBlock({ order, customer }) {
  const ship = order?.ship_to || {}
  const lines = [
    `ORDER: ${order?.order_number || '—'}`,
    order?.invoice_number ? `INVOICE: ${order.invoice_number}` : null,
    `STATUS: ${order?.status || '—'}`,
    order?.placed_at
      ? `PLACED: ${new Date(order.placed_at).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' })}`
      : null,
    '',
    '── CUSTOMER ──',
    customer?.full_name || '—',
    customer?.email || null,
    customer?.phone ? formatPhoneUAE(customer.phone) : null,
    '',
    '── DELIVERY (UAE) ──',
    ...formatDubaiAddressLines(ship),
  ]

  if (order?.is_gift) {
    lines.push('', '── GIFT ──', order.gift_note?.trim() || '(Gift order — no message)')
  }

  if (order?.payment_method) {
    lines.push('', '── PAYMENT ──', `${order.payment_method}${order.payment_mode ? ` · ${order.payment_mode}` : ''}`)
    const ref = order.payment_collection?.transaction_ref_masked || order.payment_collection?.transaction_ref
    if (ref) lines.push(`Transaction: ${ref}`)
    if (order.paid_at) lines.push(`Paid at: ${order.paid_at}`)
  }

  return lines.filter((l) => l !== null).join('\n')
}

export async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}
