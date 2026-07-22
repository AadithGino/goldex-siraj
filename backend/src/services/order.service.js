import mongoose from 'mongoose'
import { Counter } from '../models/audit.models.js'
import { ProductImage, StoreSetting, Variant } from '../models/catalog.models.js'
import { Address, CartItem, Coupon, Order, PaymentEvent, ReturnRequest } from '../models/commerce.models.js'
import { Customer } from '../models/auth.models.js'
import { StockMovement } from '../models/rate.models.js'
import { AppError } from '../utils/AppError.js'
import { roundMoney } from '../utils/money.js'
import { paginationMeta, parsePagination } from '../utils/pagination.js'
import { reserveCouponRedemption, rollbackCouponRedemption } from './coupon.service.js'
import { applyStockDelta } from './inventory.service.js'
import { calculateCartTotals, getPriceBreakup, validateCoupon } from './pricing.service.js'
import { allocatePaidAmounts } from './refund.service.js'
import * as walletService from './wallet.service.js'

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function nextSequence(key, prefix, session) {
  const counter = await Counter.findOneAndUpdate({ key }, { $inc: { value: 1 } }, { upsert: true, new: true, session })
  return `${prefix}-${new Date().getUTCFullYear()}-${String(counter.value).padStart(7, '0')}`
}

function assertCheckoutLimits(settings, paymentMethod, orderTotal) {
  const total = roundMoney(orderTotal)
  const minimum = Number(settings?.minimumOrderAmount || 0)
  if (minimum > 0 && total < minimum) {
    throw new AppError(422, 'MINIMUM_ORDER_NOT_MET', `Order total must be at least AED ${minimum.toFixed(2)}`, { minimum_order_amount: minimum, order_total: total })
  }
  if (paymentMethod === 'cod') {
    const codMin = settings?.codMinOrderAmount
    const codMax = settings?.codMaxOrderAmount
    if (codMin != null && total < Number(codMin)) {
      throw new AppError(409, 'COD_BELOW_MINIMUM', `Cash on delivery requires a minimum order of AED ${Number(codMin).toFixed(2)}`, { cod_min_order_amount: Number(codMin), order_total: total })
    }
    if (codMax != null && total > Number(codMax)) {
      throw new AppError(409, 'COD_ABOVE_MAXIMUM', `Cash on delivery is limited to AED ${Number(codMax).toFixed(2)}`, { cod_max_order_amount: Number(codMax), order_total: total })
    }
  }
}

async function resolveProductImageUrl(productId, variantId, session) {
  const images = await ProductImage.find({ productId }).sort({ displayOrder: 1, createdAt: 1 }).session(session)
  if (!images.length) return null
  const variantPrimary = variantId
    ? images.find((img) => img.variantId && String(img.variantId) === String(variantId) && img.isPrimary)
    : null
  const productPrimary = images.find((img) => img.isPrimary)
  return (variantPrimary || productPrimary || images[0])?.imageUrl || null
}

async function buildLines(cart, session, ignoreFixedPrice = false) {
  const lines = []
  const rateMap = {}
  for (const item of cart) {
    const variant = await Variant.findOne({ _id: item.variantId, isActive: true }).populate('productId').session(session)
    if (!variant?.productId || variant.productId.status !== 'active') throw new AppError(409, 'PRODUCT_UNAVAILABLE', 'An item in the bag is no longer available')
    const breakup = await getPriceBreakup(variant.id, 1, null, { session, ignoreFixedPrice })
    rateMap[breakup.purity] = breakup.gold_rate
    const imageUrl = await resolveProductImageUrl(variant.productId.id, variant.id, session)
    lines.push({ qty: item.qty, breakup, variant, product: variant.productId, customizationRequest: item.customizationRequest, imageUrl })
  }
  return { lines, rateMap }
}

function snapshotItems(lines) {
  return lines.map(({ qty, breakup, variant, product, customizationRequest, imageUrl }) => ({
    variantId: variant.id,
    productId: product.id,
    productName: product.name,
    productNameAr: product.nameAr,
    productSlug: product.slug,
    sku: variant.sku,
    imageUrl: imageUrl || null,
    metalType: product.metalType,
    metalColor: product.metalColor,
    variantLabel: variant.label,
    variantLabelAr: variant.labelAr,
    qty,
    unitPrice: breakup.unit_price,
    weightGrams: variant.weightGrams,
    purity: breakup.purity,
    effectiveWeight: variant.effectiveWeight,
    makingCharge: breakup.making_charge,
    stoneCharge: breakup.stone_charge,
    lineTotal: breakup.line_total != null
      ? Number(breakup.line_total)
      : roundMoney(Number(breakup.total || 0) * qty),
    breakup,
    customizationRequest,
  }))
}

function orderTotalsPayload(totals) {
  return {
    subtotal: totals.subtotal,
    makingChargeTotal: totals.makingChargeTotal,
    discountAmount: totals.discountAmount,
    taxAmount: totals.taxAmount,
    shippingFee: totals.shippingFee,
    total: totals.total,
    taxBreakdown: totals.tax_breakdown
      ? {
          standardRatedTotal: totals.tax_breakdown.standard_rated_total,
          zeroRatedTotal: totals.tax_breakdown.zero_rated_total,
          exemptTotal: totals.tax_breakdown.exempt_total,
          vatTotal: totals.tax_breakdown.vat_total,
        }
      : {
          standardRatedTotal: totals.standard_rated_total || 0,
          zeroRatedTotal: totals.zero_rated_total || 0,
          exemptTotal: totals.exempt_total || 0,
          vatTotal: totals.taxAmount || 0,
        },
  }
}

function discountFromSnapshot(snapshot, rawSubtotal) {
  if (!snapshot?.discountType || snapshot.discountValue == null) return 0
  let discount = snapshot.discountType === 'percent'
    ? rawSubtotal * Number(snapshot.discountValue) / 100
    : Number(snapshot.discountValue)
  if (snapshot.maxDiscount != null) discount = Math.min(discount, Number(snapshot.maxDiscount))
  return Math.min(roundMoney(discount), rawSubtotal)
}

function customerSafeReturns(rows) {
  return rows.map((row) => ({
    id: row._id || row.id,
    orderId: row.orderId,
    kind: row.kind,
    status: row.status,
    reason: row.reason,
    requestedAt: row.requestedAt,
    resolvedAt: row.resolvedAt,
    resolutionNote: row.resolutionNote,
  }))
}

async function attachCustomerReturns(orders, customerId) {
  const list = Array.isArray(orders) ? orders : [orders]
  const ids = list.map((order) => order._id || order.id).filter(Boolean)
  if (!ids.length) return Array.isArray(orders) ? [] : { ...orders, returns: [] }
  const returns = await ReturnRequest.find({ customerId, orderId: { $in: ids } }).sort({ createdAt: -1 }).lean()
  const byOrder = new Map()
  for (const row of returns) {
    const key = String(row.orderId)
    if (!byOrder.has(key)) byOrder.set(key, [])
    byOrder.get(key).push(row)
  }
  if (Array.isArray(orders)) {
    return orders.map((order) => ({
      ...order.toObject?.() ?? order,
      returns: customerSafeReturns(byOrder.get(String(order._id || order.id)) || []),
    }))
  }
  return {
    ...orders.toObject?.() ?? orders,
    returns: customerSafeReturns(byOrder.get(String(orders._id || orders.id)) || []),
  }
}

async function displayImageFallbackMap(orders) {
  const list = Array.isArray(orders) ? orders : [orders]
  const productIds = [...new Set(list.flatMap((order) => (order.items || []).filter((item) => !item.imageUrl && item.productId).map((item) => String(item.productId))))]
  if (!productIds.length) return {}
  const images = await ProductImage.find({ productId: { $in: productIds } }).sort({ displayOrder: 1 }).lean()
  const map = {}
  for (const image of images) {
    const key = String(image.productId)
    if (map[key]) continue
    if (image.isPrimary || !map[key]) map[key] = image.imageUrl
  }
  for (const image of images) {
    const key = String(image.productId)
    if (!map[key]) map[key] = image.imageUrl
  }
  return map
}

function isOrderIdempotencyDuplicate(error, customerId, idempotencyKey) {
  if (error?.code !== 11000 && error?.cause?.code !== 11000) return false
  const dup = error?.code === 11000 ? error : error.cause
  const pattern = dup?.keyPattern || {}
  const values = dup?.keyValue || {}
  if (pattern.customerId && pattern.idempotencyKey) return true
  if (values.idempotencyKey != null && String(values.idempotencyKey) === String(idempotencyKey)) {
    if (values.customerId == null || String(values.customerId) === String(customerId)) return true
  }
  if (pattern.orderId || pattern.couponId) return false
  if (pattern.idempotencyKey && !pattern.customerId) return false
  return false
}

function isRetriableDuplicateRace(error) {
  return error?.code === 11000 || error?.cause?.code === 11000
}

export async function placeOrder(customerId, input) {
  const idempotencyKey = String(input.idempotency_key || '').trim()
  if (!idempotencyKey) throw new AppError(422, 'IDEMPOTENCY_REQUIRED', 'Idempotency key is required')
  const prior = await Order.findOne({ customerId, idempotencyKey })
  if (prior) return prior
  const paymentMethod = input.payment_method === 'cod' ? 'cod' : 'manual'
  const settings = await StoreSetting.findOne({ singleton: 'default' })
  if (paymentMethod === 'cod' && settings && !settings.codEnabled) throw new AppError(409, 'COD_DISABLED', 'Cash on delivery is unavailable')
  if (paymentMethod === 'manual' && settings && !settings.bankTransferEnabled) throw new AppError(409, 'BANK_TRANSFER_DISABLED', 'Bank transfer is unavailable')

  const maxAttempts = 5
  let lastError
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const session = await mongoose.startSession()
    try {
      return await session.withTransaction(async () => {
        const existing = await Order.findOne({ customerId, idempotencyKey }).session(session)
        if (existing) return existing
        const [cart, address] = await Promise.all([CartItem.find({ customerId }).session(session), Address.findOne({ _id: input.address_id, customerId }).session(session)])
        if (!cart.length) throw new AppError(409, 'EMPTY_CART', 'Bag is empty')
        if (!address) throw new AppError(422, 'ADDRESS_NOT_FOUND', 'Delivery address not found')
        const { lines, rateMap } = await buildLines(cart, session, true)
        const rawSubtotal = lines.reduce((sum, line) => sum + line.breakup.unit_subtotal_before_vat * line.qty, 0)
        const couponResult = input.coupon_code ? await validateCoupon(input.coupon_code, rawSubtotal, customerId) : { valid: true, discount_amount: 0 }
        if (input.coupon_code && !couponResult.valid) throw new AppError(409, 'COUPON_INVALID', `Coupon cannot be applied: ${couponResult.reason}`)
        const totals = await calculateCartTotals(lines, couponResult.discount_amount)
        assertCheckoutLimits(settings, paymentMethod, totals.total)

        const requestedWallet = Number(input.wallet_use || 0)
        if (!Number.isFinite(requestedWallet) || requestedWallet < 0) {
          throw new AppError(422, 'INVALID_WALLET_USE', 'wallet_use must be a non-negative finite number')
        }
        const availableWallet = await walletService.balance(customerId, session)
        const walletApplied = roundMoney(Math.min(requestedWallet, availableWallet, totals.total))
        const orderNumber = await nextSequence(`order-${new Date().getUTCFullYear()}`, 'ORD', session)
        for (const line of lines) {
          await applyStockDelta({
            variantId: line.variant.id,
            delta: -line.qty,
            reason: 'order_placed',
            referenceType: 'order',
            note: orderNumber,
            idempotencyKey: `order-placed:${orderNumber}:${line.variant.id}`,
            session,
            requireAvailable: true,
          })
        }
        const couponSnapshot = couponResult.coupon_id
          ? {
              couponId: couponResult.coupon_id,
              code: couponResult.code,
              discountType: couponResult.discount_type,
              discountValue: couponResult.discount_value,
              maxDiscount: couponResult.max_discount,
              discountAmountAtPlacement: couponResult.discount_amount,
            }
          : null
        const [order] = await Order.create([{
          customerId,
          orderNumber,
          status: 'placed',
          paymentMethod,
          paymentStatus: paymentMethod === 'cod' ? 'cod_pending' : 'pending',
          pricingMode: paymentMethod === 'cod' ? 'cod_delivery' : 'manual_locked',
          ...orderTotalsPayload(totals),
          estimatedTotal: totals.total,
          finalTotal: null,
          amountDue: roundMoney(totals.total - walletApplied),
          walletApplied,
          couponCode: couponResult.code || null,
          couponSnapshot,
          shipTo: address.toObject(),
          isGift: Boolean(input.is_gift),
          giftNote: input.gift_note,
          items: snapshotItems(lines),
          goldRateSnapshot: rateMap,
          idempotencyKey,
          statusHistory: [{ status: 'placed', note: 'Order placed' }],
        }], { session })
        for (const movement of await StockMovement.find({ referenceType: 'order', note: orderNumber }).session(session)) {
          movement.referenceId = order.id
          await movement.save({ session })
        }
        if (walletApplied > 0) {
          await walletService.debit({
            customerId,
            amount: walletApplied,
            type: 'purchase',
            referenceType: 'order',
            referenceId: order.id,
            idempotencyKey: `order-wallet:${order.id}`,
            note: `Wallet reserved for ${orderNumber}`,
          }, { session })
        }
        if (couponResult.coupon_id) {
          await reserveCouponRedemption({
            couponId: couponResult.coupon_id,
            customerId,
            orderId: order.id,
            discountAmount: couponResult.discount_amount,
          }, { session })
        }
        await CartItem.deleteMany({ customerId }, { session })
        return order
      })
    } catch (error) {
      lastError = error
      if (isOrderIdempotencyDuplicate(error, customerId, idempotencyKey)) {
        const order = await Order.findOne({ customerId, idempotencyKey })
        if (order) return order
      }
      if (isRetriableDuplicateRace(error) && attempt < maxAttempts - 1) continue
      throw error
    } finally {
      await session.endSession()
    }
  }
  throw lastError
}

async function repriceOrder(order, session) {
  const lines = []
  const rateMap = {}
  for (const item of order.items) {
    const breakup = await getPriceBreakup(item.variantId, 1, null, { session, ignoreFixedPrice: true })
    rateMap[breakup.purity] = breakup.gold_rate
    lines.push({ qty: item.qty, breakup })
  }
  const rawSubtotal = lines.reduce((sum, line) => sum + line.breakup.unit_subtotal_before_vat * line.qty, 0)

  let discount = 0
  if (order.couponSnapshot?.discountType) {
    discount = discountFromSnapshot(order.couponSnapshot, rawSubtotal)
  } else if (order.couponCode) {
    // Legacy orders without snapshot: keep stored discount when coupon record is gone/inactive
    const coupon = await Coupon.findOne({ code: order.couponCode }).session(session)
    if (coupon) {
      discount = discountFromSnapshot({
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscount: coupon.maxDiscount,
      }, rawSubtotal)
    } else {
      discount = Math.min(roundMoney(Number(order.discountAmount || 0)), rawSubtotal)
    }
  }

  const totals = await calculateCartTotals(lines, discount)
  for (let i = 0; i < order.items.length; i += 1) {
    const item = order.items[i]
    const line = lines[i]
    item.unitPrice = line.breakup.unit_price
    item.lineTotal = line.breakup.line_total
    item.breakup = line.breakup
    item.makingCharge = line.breakup.making_charge
    item.stoneCharge = line.breakup.stone_charge
    item.purity = line.breakup.purity
  }
  return { totals: orderTotalsPayload(totals), rateMap, rawTotals: totals }
}

async function collectPayment(orderId, staffId, mode, input, deliver) {
  const session = await mongoose.startSession()
  try {
    return await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session)
      if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
      if (order.paymentStatus === 'paid') return order
      if (['cancelled', 'returned'].includes(order.status)) throw new AppError(409, 'ORDER_CLOSED', 'Closed order cannot be paid')
      if (deliver && order.paymentMethod !== 'cod') throw new AppError(409, 'NOT_COD_ORDER', 'This is not a COD order')
      if (deliver && order.status !== 'shipped') throw new AppError(409, 'ORDER_NOT_AT_HANDOVER', 'Order must be shipped before COD handover')
      if (!deliver && order.paymentMethod !== 'manual') throw new AppError(409, 'NOT_MANUAL_ORDER', 'Use COD handover for this order')

      // COD handover: live reprice. Manual payment: preserve placement snapshots.
      let totals
      let rateMap = order.goldRateSnapshot || {}
      if (deliver) {
        const repriced = await repriceOrder(order, session)
        totals = repriced.totals
        rateMap = repriced.rateMap
      } else {
        const lockedTotal = roundMoney(Number(order.finalTotal ?? order.total ?? 0))
        totals = {
          subtotal: order.subtotal,
          discountAmount: order.discountAmount,
          taxAmount: order.taxAmount,
          shippingFee: order.shippingFee,
          total: lockedTotal,
          makingChargeTotal: order.makingChargeTotal,
          taxBreakdown: order.taxBreakdown,
        }
      }

      let walletApplied = order.walletApplied
      if (walletApplied > totals.total) {
        const excess = roundMoney(walletApplied - totals.total)
        walletApplied = totals.total
        await walletService.credit({
          customerId: order.customerId,
          amount: excess,
          type: 'refund',
          referenceType: 'order',
          referenceId: order.id,
          idempotencyKey: `wallet-excess:${order.id}`,
          note: 'Excess wallet reservation returned after final pricing',
          createdBy: staffId,
        }, { session })
      }
      const expectedAmount = roundMoney(totals.total - walletApplied)
      const providedRaw = input.amount ?? input.amount_collected ?? input.amountCollected
      if (providedRaw == null || providedRaw === '') {
        throw new AppError(422, 'AMOUNT_REQUIRED', 'Collected amount is required')
      }
      const providedAmount = roundMoney(Number(providedRaw))
      if (!Number.isFinite(providedAmount) || providedAmount <= 0) {
        throw new AppError(422, 'INVALID_AMOUNT', 'Collected amount must be a positive finite number')
      }
      if (Math.abs(providedAmount - expectedAmount) > 0.01) {
        throw new AppError(409, 'AMOUNT_MISMATCH', `Collected amount must be ${expectedAmount.toFixed(2)}`, {
          expected_amount: expectedAmount,
          collected_amount: providedAmount,
        })
      }
      const collectedAmount = expectedAmount
      const invoiceNumber = order.invoiceNumber || await nextSequence(`invoice-${new Date().getUTCFullYear()}`, 'INV', session)
      if (deliver) {
        Object.assign(order, totals, {
          total: totals.total,
          finalTotal: totals.total,
          goldRateSnapshot: rateMap,
        })
      } else if (order.finalTotal == null) {
        order.finalTotal = roundMoney(Number(order.total || 0))
      }
      Object.assign(order, {
        amountDue: 0,
        walletApplied,
        paymentMode: mode,
        paymentStatus: 'paid',
        invoiceNumber,
        finalizedAt: order.finalizedAt || new Date(),
        paidAt: new Date(),
        paymentCollection: {
          amount: collectedAmount,
          expectedAmount,
          currency: 'AED',
          collectedBy: staffId,
          transactionRef: input.transaction_ref,
          note: input.note,
          verifiedAt: new Date(),
        },
      })
      allocatePaidAmounts(order)
      if (deliver) {
        order.status = 'delivered'
        order.deliveredAt = new Date()
        order.statusHistory.push({ status: 'delivered', note: 'COD handed over and cash collected', changedBy: staffId })
      }
      // Unique transactionId prevents duplicate payment events on retry.
      const transactionId = input.transaction_ref || `${deliver ? 'cod' : 'manual'}:${order.id}`
      try {
        await PaymentEvent.create([{
          orderId: order.id,
          provider: 'manual',
          eventType: deliver ? 'cod_collected' : 'manual_payment_verified',
          transactionId,
          amount: collectedAmount,
          currency: 'AED',
          verified: true,
          payload: {
            mode,
            pricing_mode: order.pricingMode,
            expected_amount: expectedAmount,
            collected_amount: collectedAmount,
            goldRateSnapshot: deliver ? rateMap : undefined,
          },
          processedAt: new Date(),
        }], { session })
      } catch (error) {
        if (error?.code !== 11000 && error?.cause?.code !== 11000) throw error
        // Concurrent confirmation already wrote the event; reload paid order.
        const paid = await Order.findById(orderId).session(session)
        if (paid?.paymentStatus === 'paid') return paid
        throw error
      }
      await order.save({ session })
      return order
    })
  } finally {
    await session.endSession()
  }
}

export const finalizeCodHandover = (orderId, staffId, input = {}) => collectPayment(orderId, staffId, 'cash', input, true)
export function markManualPaid(orderId, staffId, input = {}) {
  if (!['bank_transfer', 'card'].includes(input.payment_mode)) throw new AppError(422, 'INVALID_PAYMENT_MODE', 'Payment mode must be bank_transfer or card')
  if (!String(input.transaction_ref || '').trim()) throw new AppError(422, 'TRANSACTION_REFERENCE_REQUIRED', 'Bank/card reference is required')
  return collectPayment(orderId, staffId, input.payment_mode, input, false)
}

export async function listCustomerOrders(customerId, query = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 50, maxLimit: 100 })
  const filter = { customerId }
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ placedAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ])
  const withReturns = await attachCustomerReturns(orders, customerId)
  const imageMap = await displayImageFallbackMap(withReturns)
  return { orders: withReturns, displayImageByProductId: imageMap, ...paginationMeta(page, limit, total) }
}

export async function getCustomerOrder(customerId, id) {
  const order = await Order.findOne({ _id: id, customerId })
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
  const withReturns = await attachCustomerReturns(order, customerId)
  const imageMap = await displayImageFallbackMap(withReturns)
  return { order: withReturns, displayImageByProductId: imageMap }
}

export async function listAdminOrders(query = {}) {
  const filter = {}
  const status = query.status
  if (status && status !== 'all' && status !== 'pending_requests') {
    filter.status = status
  }
  if (query.payment_status) filter.paymentStatus = query.payment_status
  if (query.customer_id || query.customerId) {
    filter.customerId = query.customer_id || query.customerId
  }

  const dateFrom = query.date_from || query.dateFrom
  const dateTo = query.date_to || query.dateTo
  if (dateFrom || dateTo) {
    filter.placedAt = {}
    if (dateFrom) filter.placedAt.$gte = new Date(`${String(dateFrom).slice(0, 10)}T00:00:00.000Z`)
    if (dateTo) filter.placedAt.$lte = new Date(`${String(dateTo).slice(0, 10)}T23:59:59.999Z`)
  }

  if (status === 'pending_requests') {
    const pending = await ReturnRequest.find({ status: { $in: ['requested', 'approved'] } })
      .select('orderId')
      .lean()
    filter._id = { $in: pending.map((row) => row.orderId) }
  }

  const search = String(query.search || '').trim()
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i')
    const customers = await Customer.find({
      $or: [{ fullName: re }, { phone: re }, { email: re }],
    }).select('_id').limit(200).lean()
    filter.$or = [
      { orderNumber: re },
      { invoiceNumber: re },
      { customerId: { $in: customers.map((row) => row._id) } },
    ]
  }

  const { page, limit, skip } = parsePagination(query, { defaultLimit: 50, maxLimit: 100 })
  const [orders, total] = await Promise.all([
    Order.find(filter).populate('customerId').sort({ placedAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
  ])
  const returns = await ReturnRequest.find({ orderId: { $in: orders.map((order) => order._id) } }).lean()
  const items = orders.map((order) => ({
    ...order,
    returns: returns.filter((item) => String(item.orderId) === String(order._id)),
  }))
  return { items, ...paginationMeta(page, limit, total) }
}

export async function getAdminOrder(id) {
  const order = await Order.findById(id).populate('customerId').populate('paymentCollection.collectedBy', 'fullName email role').lean()
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
  const returns = await ReturnRequest.find({ orderId: id }).sort({ createdAt: -1 }).lean()
  const events = await PaymentEvent.find({ orderId: id }).sort({ createdAt: -1 }).lean()
  return { ...order, returns, payment_events: events }
}

export async function updateStatus(orderId, status, note, staffId) {
  const order = await Order.findById(orderId)
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
  const transitions = {
    placed: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],
    partially_returned: [],
    cancelled: [],
    returned: [],
  }
  if (!transitions[order.status]?.includes(status)) throw new AppError(409, 'INVALID_STATUS_TRANSITION', `Cannot move order from ${order.status} to ${status}`)
  if (status === 'cancelled') return cancelOrder(orderId, staffId, note)
  if (status === 'delivered' && order.paymentStatus !== 'paid') throw new AppError(409, 'PAYMENT_REQUIRED', 'Use COD handover to collect payment before delivery')
  order.status = status
  if (status === 'delivered') order.deliveredAt = new Date()
  order.statusHistory.push({ status, note, changedBy: staffId })
  return order.save()
}

export async function cancelOrder(orderId, staffId, note, { session: externalSession } = {}) {
  const run = async (session) => {
    const order = await Order.findById(orderId).session(session)
    if (!order || order.status === 'cancelled') return order
    if (['delivered', 'returned'].includes(order.status)) throw new AppError(409, 'CANNOT_CANCEL', 'Delivered order cannot be cancelled')
    for (const item of order.items) {
      await applyStockDelta({
        variantId: item.variantId,
        delta: item.qty,
        reason: 'order_cancelled',
        referenceType: 'order',
        referenceId: order.id,
        idempotencyKey: `order-cancelled:${order.id}:${item.variantId}`,
        actorId: staffId,
        session,
      })
    }
    const wasPaid = order.paymentStatus === 'paid'
    const paidTotal = roundMoney(Number(order.finalTotal ?? order.total ?? 0))
    const walletReserved = roundMoney(Number(order.walletApplied || 0))
    // Paid orders: credit the full paid total to wallet (covers wallet + external collection).
    // Unpaid orders: release only the wallet reservation.
    const refundAmount = wasPaid ? paidTotal : walletReserved
    if (refundAmount > 0) {
      await walletService.credit({
        customerId: order.customerId,
        amount: refundAmount,
        type: 'refund',
        referenceType: 'order',
        referenceId: order.id,
        idempotencyKey: `cancel-refund:${order.id}`,
        note: wasPaid ? 'Paid order cancellation refunded to wallet' : 'Wallet returned on cancellation',
        createdBy: staffId,
      }, { session })
      await PaymentEvent.create([{
        orderId: order.id,
        provider: 'wallet',
        eventType: 'order_cancel_refund',
        transactionId: `cancel-refund:${order.id}`,
        amount: refundAmount,
        currency: 'AED',
        verified: true,
        payload: {
          was_paid: wasPaid,
          payment_method: order.paymentMethod,
          payment_mode: order.paymentMode,
          wallet_applied: walletReserved,
          paid_total: paidTotal,
        },
        processedAt: new Date(),
      }], { session })
      order.refundedTotal = roundMoney(Number(order.refundedTotal || 0) + refundAmount)
    }
    await rollbackCouponRedemption({
      orderId: order.id,
      reason: note || 'Order cancelled',
      staffId,
    }, { session })
    order.status = 'cancelled'
    if (wasPaid) {
      if (!(refundAmount > 0)) throw new AppError(409, 'REFUND_REQUIRED', 'Paid cancellation requires a completed refund ledger entry')
      order.paymentStatus = 'refunded'
    }
    order.statusHistory.push({ status: 'cancelled', note, changedBy: staffId })
    await order.save({ session })
    return order
  }

  if (externalSession) return run(externalSession)

  const session = await mongoose.startSession()
  try {
    return await session.withTransaction(async () => run(session))
  } finally {
    await session.endSession()
  }
}
