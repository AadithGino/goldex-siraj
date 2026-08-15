import { Counter } from '../models/audit.models.js'
import { SellJewelleryRequest } from '../models/commerce.models.js'
import { GoldBuybackRate } from '../models/rate.models.js'
import { AppError } from '../utils/AppError.js'
import { roundMoney } from '../utils/money.js'
import { normalizePurity } from '../utils/purity.js'
import { assertAddressPayload, toAddressDto } from './address.dto.js'

const OPEN_STATUSES = ['submitted', 'needs_info', 'offered']
const MAX_OPEN_REQUESTS = 5
const MAX_IMAGES = 8

export function computeSellOffer({ netWeightGrams, ratePerGram }) {
  const weight = Number(netWeightGrams)
  const rate = Number(ratePerGram)
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new AppError(422, 'INVALID_NET_WEIGHT', 'Net weight must be greater than zero')
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new AppError(409, 'GOLD_BUYBACK_RATE_MISSING', 'Current sell-in gold rate is unavailable for this purity')
  }
  return {
    netWeightGrams: weight,
    ratePerGram: rate,
    amount: roundMoney(weight * rate),
  }
}

async function nextRequestNumber() {
  const year = new Date().getUTCFullYear()
  const counter = await Counter.findOneAndUpdate(
    { key: `sell-jewellery-${year}` },
    { $inc: { value: 1 } },
    { upsert: true, new: true },
  )
  return `SG-${year}-${String(counter.value).padStart(5, '0')}`
}

function assertOwned(doc, customerId) {
  if (!doc || String(doc.customerId) !== String(customerId)) {
    throw new AppError(404, 'SELL_REQUEST_NOT_FOUND', 'Sell jewellery request not found')
  }
  return doc
}

async function loadRequest(id) {
  const doc = await SellJewelleryRequest.findById(id)
  if (!doc) throw new AppError(404, 'SELL_REQUEST_NOT_FOUND', 'Sell jewellery request not found')
  return doc
}

function offerExpired(doc) {
  const until = doc.offer?.validUntil
  if (!until) return false
  return new Date(until).getTime() < Date.now()
}

async function currentBuybackRate(purity) {
  const rate = await GoldBuybackRate.findOne({ purity, isCurrent: true }).sort({ effectiveAt: -1 })
  if (!rate) {
    throw new AppError(409, 'GOLD_BUYBACK_RATE_MISSING', `Current ${purity} sell-in gold rate is unavailable`)
  }
  return rate
}

function normalizePickupAddress(input) {
  const dto = toAddressDto({
    ...input,
    label: input?.label || 'home',
    country: input?.country || 'United Arab Emirates',
  })
  return assertAddressPayload(dto, { partial: false })
}

function adminPopulate(query) {
  return query
    .populate('customerId', 'fullName phone email')
    .populate('offeredBy', 'fullName email')
    .populate('resolvedBy', 'fullName email')
}

export async function createRequest(customerId, input) {
  const openCount = await SellJewelleryRequest.countDocuments({
    customerId,
    status: { $in: OPEN_STATUSES },
  })
  if (openCount >= MAX_OPEN_REQUESTS) {
    throw new AppError(409, 'TOO_MANY_OPEN_REQUESTS', `You can have at most ${MAX_OPEN_REQUESTS} open sell requests`)
  }

  const purity = normalizePurity(input.purity)
  const images = (input.image_keys || []).map((key) => ({ key: String(key).trim() })).filter((row) => row.key)
  if (!images.length) throw new AppError(422, 'IMAGES_REQUIRED', 'Upload at least one jewellery photo')

  const buyback = await currentBuybackRate(purity)
  const weight = Number(input.net_weight_grams)
  const indicative = {
    ...computeSellOffer({ netWeightGrams: weight, ratePerGram: buyback.ratePerGram }),
    quotedAt: new Date(),
  }

  const invoiceKey = input.invoice_key == null || input.invoice_key === ''
    ? null
    : String(input.invoice_key).trim()

  return SellJewelleryRequest.create({
    requestNumber: await nextRequestNumber(),
    customerId,
    jewelleryType: input.jewellery_type || 'other',
    purity,
    netWeightGrams: weight,
    notes: input.notes || '',
    images,
    invoice: invoiceKey ? { key: invoiceKey } : null,
    pickupAddress: normalizePickupAddress(input.pickup_address),
    indicative,
    status: 'submitted',
  })
}

export async function listCustomerRequests(customerId) {
  return SellJewelleryRequest.find({ customerId }).sort({ createdAt: -1 }).limit(50)
}

export async function getCustomerRequest(customerId, id) {
  return assertOwned(await loadRequest(id), customerId)
}

export async function cancelRequest(customerId, id) {
  const doc = assertOwned(await loadRequest(id), customerId)
  if (!OPEN_STATUSES.includes(doc.status)) {
    throw new AppError(409, 'REQUEST_NOT_CANCELLABLE', 'Only open sell requests can be cancelled')
  }
  doc.status = 'cancelled'
  doc.resolvedAt = new Date()
  await doc.save()
  return doc
}

export async function replyToRequest(customerId, id, input) {
  const doc = assertOwned(await loadRequest(id), customerId)
  if (doc.status !== 'needs_info') {
    throw new AppError(409, 'REPLY_NOT_ALLOWED', 'More details can only be added when the studio has asked for them')
  }

  const extraKeys = (input.image_keys || []).map((key) => String(key).trim()).filter(Boolean)
  const nextImages = [...doc.images]
  for (const key of extraKeys) {
    if (nextImages.length >= MAX_IMAGES) break
    if (!nextImages.some((row) => row.key === key)) nextImages.push({ key })
  }
  doc.images = nextImages
  doc.messages.push({
    author: 'customer',
    body: input.message,
    imageKeys: extraKeys,
    createdAt: new Date(),
  })
  doc.status = 'submitted'
  await doc.save()
  return doc
}

export async function acceptOffer(customerId, id) {
  const doc = assertOwned(await loadRequest(id), customerId)
  if (doc.status !== 'offered') {
    throw new AppError(409, 'OFFER_NOT_AVAILABLE', 'This request does not have an active offer to accept')
  }
  if (offerExpired(doc)) {
    throw new AppError(409, 'OFFER_EXPIRED', 'This offer has expired. Please wait for a revised offer.')
  }
  doc.status = 'accepted'
  await doc.save()
  return doc
}

export async function declineOffer(customerId, id, reason = '') {
  const doc = assertOwned(await loadRequest(id), customerId)
  if (doc.status !== 'offered') {
    throw new AppError(409, 'OFFER_NOT_AVAILABLE', 'This request does not have an active offer to decline')
  }
  doc.status = 'declined'
  doc.declinedBy = 'customer'
  doc.declineReason = reason || ''
  doc.resolvedAt = new Date()
  await doc.save()
  return doc
}

export async function listAdminRequests(query = {}) {
  const filter = {}
  if (query.status && query.status !== 'all') filter.status = query.status
  return adminPopulate(SellJewelleryRequest.find(filter))
    .sort({ createdAt: -1 })
    .limit(100)
}

export async function getAdminRequest(id) {
  const doc = await adminPopulate(SellJewelleryRequest.findById(id))
  if (!doc) throw new AppError(404, 'SELL_REQUEST_NOT_FOUND', 'Sell jewellery request not found')
  return doc
}

export async function requestMoreInfo(id, input, _staffId) {
  const doc = await loadRequest(id)
  if (!OPEN_STATUSES.includes(doc.status)) {
    throw new AppError(409, 'REQUEST_NOT_REVIEWABLE', 'More details can only be requested on open sell requests')
  }
  doc.messages.push({
    author: 'staff',
    body: input.message,
    imageKeys: [],
    createdAt: new Date(),
  })
  if (doc.status !== 'needs_info') doc.offer = null
  doc.status = 'needs_info'
  await doc.save()
  return getAdminRequest(doc.id)
}

export async function offerRequest(id, input, staffId) {
  const doc = await loadRequest(id)
  if (!['submitted', 'needs_info', 'offered'].includes(doc.status)) {
    throw new AppError(409, 'REQUEST_NOT_OFFERABLE', 'Only open sell requests can receive an offer')
  }

  const weight = input.net_weight_grams != null ? Number(input.net_weight_grams) : doc.netWeightGrams
  let rate = input.rate_per_gram != null ? Number(input.rate_per_gram) : null
  if (rate == null) {
    const buyback = await currentBuybackRate(doc.purity)
    rate = buyback.ratePerGram
  }

  const computed = computeSellOffer({ netWeightGrams: weight, ratePerGram: rate })
  const offeredAt = new Date()
  const validDays = Number(input.valid_days) || 7
  doc.offer = {
    ...computed,
    notes: input.admin_notes || '',
    offeredAt,
    validUntil: new Date(offeredAt.getTime() + validDays * 24 * 60 * 60 * 1000),
  }
  doc.status = 'offered'
  doc.offeredBy = staffId
  await doc.save()
  return getAdminRequest(doc.id)
}

export async function declineRequest(id, input, staffId) {
  const doc = await loadRequest(id)
  if (!OPEN_STATUSES.includes(doc.status)) {
    throw new AppError(409, 'REQUEST_NOT_DECLINABLE', 'Only open sell requests can be declined')
  }
  doc.status = 'declined'
  doc.declinedBy = 'staff'
  doc.declineReason = input.reason || ''
  doc.resolvedBy = staffId
  doc.resolvedAt = new Date()
  await doc.save()
  return getAdminRequest(doc.id)
}

export async function completeRequest(id, input, staffId) {
  const doc = await loadRequest(id)
  if (doc.status !== 'accepted') {
    throw new AppError(409, 'REQUEST_NOT_COMPLETABLE', 'Only accepted requests can be marked complete')
  }
  doc.status = 'completed'
  doc.completionNote = input.note || ''
  doc.resolvedBy = staffId
  doc.resolvedAt = new Date()
  await doc.save()
  return getAdminRequest(doc.id)
}
