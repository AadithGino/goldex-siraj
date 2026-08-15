import { Counter } from '../models/audit.models.js'
import { TaxSetting } from '../models/catalog.models.js'
import { CustomJewelleryRequest } from '../models/commerce.models.js'
import { GoldRate } from '../models/rate.models.js'
import { AppError } from '../utils/AppError.js'
import { roundMoney } from '../utils/money.js'
import { normalizePurity } from '../utils/purity.js'
import { computeVat } from './pricingCalculator.js'

const OPEN_STATUSES = ['submitted', 'quoted']
const MAX_OPEN_REQUESTS = 5

export function computeCustomQuote({
  goldWeightGrams,
  goldRatePerGram,
  makingChargeType = 'percent',
  makingChargeValue = 0,
  wastagePercent = 0,
  stoneCharge = 0,
  tax = null,
}) {
  const weight = Number(goldWeightGrams)
  const rate = Number(goldRatePerGram)
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new AppError(422, 'INVALID_GOLD_WEIGHT', 'Gold weight must be greater than zero')
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new AppError(409, 'GOLD_RATE_MISSING', 'Current gold rate is unavailable for this purity')
  }

  const goldValue = roundMoney(weight * rate)
  const wastageAmount = roundMoney(goldValue * (Number(wastagePercent) || 0) / 100)
  const makingCharge = makingChargeType === 'flat'
    ? roundMoney(Number(makingChargeValue) || 0)
    : roundMoney(goldValue * (Number(makingChargeValue) || 0) / 100)
  const stone = roundMoney(Number(stoneCharge) || 0)
  const subtotal = roundMoney(goldValue + wastageAmount + makingCharge + stone)
  const applyOn = tax?.applyOn || 'total'
  const taxableBase = applyOn === 'making_only' ? makingCharge : subtotal
  const vat = computeVat({ taxableBase, tax, taxTreatment: 'standard' })
  const total = vat.tax_mode === 'inclusive'
    ? subtotal
    : roundMoney(subtotal + vat.vat_amount)

  return {
    goldWeightGrams: weight,
    goldRatePerGram: rate,
    goldValue,
    wastagePercent: Number(wastagePercent) || 0,
    wastageAmount,
    makingChargeType: makingChargeType === 'flat' ? 'flat' : 'percent',
    makingChargeValue: Number(makingChargeValue) || 0,
    makingCharge,
    stoneCharge: stone,
    subtotal,
    vatPercent: vat.vat_percent,
    vatAmount: vat.vat_amount,
    taxMode: vat.tax_mode,
    total,
  }
}

async function nextRequestNumber() {
  const year = new Date().getUTCFullYear()
  const counter = await Counter.findOneAndUpdate(
    { key: `custom-jewellery-${year}` },
    { $inc: { value: 1 } },
    { upsert: true, new: true },
  )
  return `CJ-${year}-${String(counter.value).padStart(5, '0')}`
}

function assertOwned(doc, customerId) {
  if (!doc || String(doc.customerId) !== String(customerId)) {
    throw new AppError(404, 'CUSTOM_REQUEST_NOT_FOUND', 'Custom jewellery request not found')
  }
  return doc
}

async function loadRequest(id) {
  const doc = await CustomJewelleryRequest.findById(id)
  if (!doc) throw new AppError(404, 'CUSTOM_REQUEST_NOT_FOUND', 'Custom jewellery request not found')
  return doc
}

function quoteExpired(doc) {
  const until = doc.quote?.validUntil
  if (!until) return false
  return new Date(until).getTime() < Date.now()
}

export async function createRequest(customerId, input) {
  const openCount = await CustomJewelleryRequest.countDocuments({
    customerId,
    status: { $in: OPEN_STATUSES },
  })
  if (openCount >= MAX_OPEN_REQUESTS) {
    throw new AppError(409, 'TOO_MANY_OPEN_REQUESTS', `You can have at most ${MAX_OPEN_REQUESTS} open custom requests`)
  }

  const purity = normalizePurity(input.purity)
  const images = (input.image_keys || []).map((key) => ({ key: String(key).trim() })).filter((row) => row.key)
  if (!images.length) throw new AppError(422, 'IMAGES_REQUIRED', 'Upload at least one design reference image')

  return CustomJewelleryRequest.create({
    requestNumber: await nextRequestNumber(),
    customerId,
    jewelleryType: input.jewellery_type,
    purity,
    metalColor: input.metal_color || 'yellow',
    goldWeightGrams: Number(input.gold_weight_grams),
    sizeLabel: input.size_label || '',
    description: input.description,
    budgetAed: input.budget_aed == null || input.budget_aed === '' ? null : Number(input.budget_aed),
    images,
    status: 'submitted',
  })
}

export async function listCustomerRequests(customerId) {
  return CustomJewelleryRequest.find({ customerId }).sort({ createdAt: -1 }).limit(50)
}

export async function getCustomerRequest(customerId, id) {
  return assertOwned(await loadRequest(id), customerId)
}

export async function cancelRequest(customerId, id) {
  const doc = assertOwned(await loadRequest(id), customerId)
  if (!OPEN_STATUSES.includes(doc.status)) {
    throw new AppError(409, 'REQUEST_NOT_CANCELLABLE', 'Only submitted or quoted requests can be cancelled')
  }
  doc.status = 'cancelled'
  doc.resolvedAt = new Date()
  await doc.save()
  return doc
}

export async function acceptQuote(customerId, id) {
  const doc = assertOwned(await loadRequest(id), customerId)
  if (doc.status !== 'quoted') {
    throw new AppError(409, 'QUOTE_NOT_AVAILABLE', 'This request does not have an active quote to accept')
  }
  if (quoteExpired(doc)) {
    throw new AppError(409, 'QUOTE_EXPIRED', 'This quote has expired. Please wait for a revised quote.')
  }
  doc.status = 'accepted'
  await doc.save()
  return doc
}

export async function declineQuote(customerId, id, reason = '') {
  const doc = assertOwned(await loadRequest(id), customerId)
  if (doc.status !== 'quoted') {
    throw new AppError(409, 'QUOTE_NOT_AVAILABLE', 'This request does not have an active quote to decline')
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
  return CustomJewelleryRequest.find(filter)
    .populate('customerId', 'fullName phone email')
    .populate('quotedBy', 'fullName email')
    .populate('resolvedBy', 'fullName email')
    .sort({ createdAt: -1 })
    .limit(100)
}

export async function getAdminRequest(id) {
  const doc = await CustomJewelleryRequest.findById(id)
    .populate('customerId', 'fullName phone email')
    .populate('quotedBy', 'fullName email')
    .populate('resolvedBy', 'fullName email')
  if (!doc) throw new AppError(404, 'CUSTOM_REQUEST_NOT_FOUND', 'Custom jewellery request not found')
  return doc
}

export async function quoteRequest(id, input, staffId) {
  const doc = await loadRequest(id)
  if (!['submitted', 'quoted'].includes(doc.status)) {
    throw new AppError(409, 'REQUEST_NOT_QUOTABLE', 'Only submitted or quoted requests can receive a quote')
  }

  const goldRate = await GoldRate.findOne({ purity: doc.purity, isCurrent: true }).sort({ effectiveAt: -1 })
  if (!goldRate) {
    throw new AppError(409, 'GOLD_RATE_MISSING', `Current ${doc.purity} gold rate is unavailable`)
  }
  const tax = await TaxSetting.findOne({ singleton: 'default' })
  const computed = computeCustomQuote({
    goldWeightGrams: doc.goldWeightGrams,
    goldRatePerGram: goldRate.ratePerGram,
    makingChargeType: input.making_charge_type,
    makingChargeValue: input.making_charge_value,
    wastagePercent: input.wastage_percent,
    stoneCharge: input.stone_charge,
    tax,
  })

  const quotedAt = new Date()
  const validDays = Number(input.valid_days) || 7
  doc.quote = {
    ...computed,
    notes: input.admin_notes || '',
    quotedAt,
    validUntil: new Date(quotedAt.getTime() + validDays * 24 * 60 * 60 * 1000),
  }
  doc.status = 'quoted'
  doc.quotedBy = staffId
  await doc.save()
  return getAdminRequest(doc.id)
}

export async function declineRequest(id, input, staffId) {
  const doc = await loadRequest(id)
  if (!['submitted', 'quoted'].includes(doc.status)) {
    throw new AppError(409, 'REQUEST_NOT_DECLINABLE', 'Only submitted or quoted requests can be declined')
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
