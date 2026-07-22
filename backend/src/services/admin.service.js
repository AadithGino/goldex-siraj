import mongoose from 'mongoose'
import { Customer, Staff } from '../models/auth.models.js'
import { AuditLog } from '../models/audit.models.js'
import { Coupon, CouponCustomerUsage, CouponRedemption, PaymentEvent } from '../models/commerce.models.js'
import { Product, Variant } from '../models/catalog.models.js'
import { AppError } from '../utils/AppError.js'
import { paginationMeta, parsePagination } from '../utils/pagination.js'
import { deserialize } from '../utils/serialize.js'
import { hashPassword, revokeAllSessions } from './auth.service.js'
import * as inventoryService from './inventory.service.js'
import {
  assertCouponBusinessRules,
  mergeCouponState,
  toCouponWriteDto,
} from './coupon.dto.js'

export async function listCustomers(query = {}) {
  const filter = {}
  if (query.search) {
    const re = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [
      { fullName: re },
      { email: re },
      { phone: re },
    ]
  }
  const status = query.status || query.is_active
  if (status === 'active' || status === true || status === 'true') filter.isActive = true
  if (status === 'inactive' || status === false || status === 'false') filter.isActive = false
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 50, maxLimit: 100 })
  const [items, total] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ])
  return { items, ...paginationMeta(page, limit, total) }
}
export async function getCustomer(id) { const customer = await Customer.findById(id); if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found'); return customer }
export async function updateCustomer(id, payload) {
  const before = await Customer.findById(id)
  if (!before) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found')
  const input = deserialize(payload)
  delete input.tokenVersion
  const deactivating = input.isActive === false && before.isActive !== false
  const customer = await Customer.findByIdAndUpdate(
    id,
    { $set: input, ...(deactivating ? { $inc: { tokenVersion: 1 } } : {}) },
    { new: true, runValidators: true },
  )
  if (deactivating) await revokeAllSessions(customer.id, 'customer')
  return customer
}

export async function listCoupons(query = {}) {
  const filter = {}
  const mapped = deserialize(query || {})
  if (mapped.search) {
    const re = new RegExp(String(mapped.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.code = re
  }
  if (mapped.isActive === true || mapped.status === 'active') filter.isActive = true
  if (mapped.isActive === false || mapped.status === 'inactive') filter.isActive = false
  const { page, limit, skip } = parsePagination(mapped, { defaultLimit: 25, maxLimit: 100 })
  const [items, total] = await Promise.all([
    Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Coupon.countDocuments(filter),
  ])
  return { items, ...paginationMeta(page, limit, total) }
}

export async function createCoupon(payload) {
  const dto = toCouponWriteDto(payload, { partial: false })
  // Create without validFrom → Mongoose default Date.now
  try {
    return await Coupon.create(dto)
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError(409, 'DUPLICATE_RESOURCE', 'A coupon with this code already exists', error.keyValue)
    }
    throw error
  }
}

export async function updateCoupon(id, payload) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, 'COUPON_NOT_FOUND', 'Coupon not found')

  const dto = toCouponWriteDto(payload, { partial: true })
  const session = await mongoose.startSession()
  try {
    return await session.withTransaction(async () => {
      const existing = await Coupon.findById(id).session(session)
      if (!existing) throw new AppError(404, 'COUPON_NOT_FOUND', 'Coupon not found')

      const merged = mergeCouponState(existing, dto)
      assertCouponBusinessRules(dto, { partial: true, merged })

      if (Object.prototype.hasOwnProperty.call(dto, 'perCustomerLimit')) {
        const maxActive = await CouponCustomerUsage.findOne({
          couponId: existing._id,
          activeCount: { $gt: Number(dto.perCustomerLimit) },
        }).select('activeCount customerId').session(session).lean()
        if (maxActive) {
          throw new AppError(
            409,
            'COUPON_CUSTOMER_LIMIT_TOO_LOW',
            `per_customer_limit cannot be lower than an existing customer's active usage (${maxActive.activeCount})`,
            {
              customer_id: String(maxActive.customerId),
              active_count: maxActive.activeCount,
              per_customer_limit: dto.perCustomerLimit,
            },
          )
        }
      }

      // Atomic with reserveCouponRedemption: only commit if usedCount still fits the new limit.
      const filter = { _id: existing._id }
      if (Object.prototype.hasOwnProperty.call(dto, 'usageLimit') && dto.usageLimit != null) {
        filter.usedCount = { $lte: Number(dto.usageLimit) }
      }

      let item
      try {
        item = await Coupon.findOneAndUpdate(filter, { $set: dto }, {
          new: true,
          runValidators: true,
          session,
        })
      } catch (error) {
        if (error?.code === 11000) {
          throw new AppError(409, 'DUPLICATE_RESOURCE', 'A coupon with this code already exists', error.keyValue)
        }
        throw error
      }

      if (!item) {
        const again = await Coupon.findById(id).session(session)
        if (!again) throw new AppError(404, 'COUPON_NOT_FOUND', 'Coupon not found')
        if (Object.prototype.hasOwnProperty.call(dto, 'usageLimit') && dto.usageLimit != null) {
          throw new AppError(
            409,
            'COUPON_USAGE_LIMIT_TOO_LOW',
            `usage_limit cannot be lower than current active usage (${again.usedCount})`,
            { used_count: again.usedCount, usage_limit: dto.usageLimit },
          )
        }
        throw new AppError(404, 'COUPON_NOT_FOUND', 'Coupon not found')
      }

      // Final invariant check inside the transaction.
      if (item.usageLimit != null && Number(item.usedCount) > Number(item.usageLimit)) {
        throw new AppError(
          409,
          'COUPON_USAGE_LIMIT_TOO_LOW',
          `usage_limit cannot be lower than current active usage (${item.usedCount})`,
          { used_count: item.usedCount, usage_limit: item.usageLimit },
        )
      }
      return item
    })
  } finally {
    await session.endSession()
  }
}

export async function deleteCoupon(id) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, 'COUPON_NOT_FOUND', 'Coupon not found')
  const coupon = await Coupon.findById(id)
  if (!coupon) throw new AppError(404, 'COUPON_NOT_FOUND', 'Coupon not found')
  const redemptionCount = await CouponRedemption.countDocuments({ couponId: id })
  if (redemptionCount > 0) {
    coupon.isActive = false
    await coupon.save()
    return { archived: true, deleted: false, coupon_id: coupon.id, redemption_count: redemptionCount }
  }
  await coupon.deleteOne()
  return { archived: false, deleted: true, coupon_id: String(id), redemption_count: 0 }
}

/** Active = status !== 'rolled_back' (missing/legacy status counts as active). */
const isActiveRedemptionExpr = { $ne: ['$$r.status', 'rolled_back'] }
const isRolledBackRedemptionExpr = { $eq: ['$$r.status', 'rolled_back'] }

export async function couponUsageSummary() {
  const redemptionCollection = CouponRedemption.collection.name
  return Coupon.aggregate([
    {
      $lookup: {
        from: redemptionCollection,
        localField: '_id',
        foreignField: 'couponId',
        as: 'redemptions',
      },
    },
    {
      $addFields: {
        active_redemptions: {
          $filter: { input: '$redemptions', as: 'r', cond: isActiveRedemptionExpr },
        },
        rolled_back_redemptions: {
          $filter: { input: '$redemptions', as: 'r', cond: isRolledBackRedemptionExpr },
        },
      },
    },
    {
      $project: {
        _id: 0,
        coupon_id: '$_id',
        code: 1,
        active_usage_count: { $size: '$active_redemptions' },
        rolled_back_count: { $size: '$rolled_back_redemptions' },
        unique_customer_count: {
          $size: {
            $setUnion: [
              { $map: { input: '$active_redemptions', as: 'r', in: '$$r.customerId' } },
              [],
            ],
          },
        },
        total_active_discount: {
          $ifNull: [{ $sum: '$active_redemptions.discountAmount' }, 0],
        },
        total_rolled_back_discount: {
          $ifNull: [{ $sum: '$rolled_back_redemptions.discountAmount' }, 0],
        },
        lifetime_usage_count: { $size: '$redemptions' },
        lifetime_discount: {
          $ifNull: [{ $sum: '$redemptions.discountAmount' }, 0],
        },
      },
    },
    { $sort: { active_usage_count: -1, code: 1 } },
  ])
}

function asPlainRef(value) {
  if (value == null) return null
  if (typeof value === 'object' && (value._id != null || value.id != null)) return value
  return null
}

function asId(value) {
  if (value == null) return null
  if (typeof value === 'object' && (value._id != null || value.id != null)) return String(value.id ?? value._id)
  return String(value)
}

export async function couponUsage(couponId, query = {}) {
  if (!mongoose.isValidObjectId(couponId)) throw new AppError(404, 'COUPON_NOT_FOUND', 'Coupon not found')
  const coupon = await Coupon.findById(couponId).select('code')
  if (!coupon) throw new AppError(404, 'COUPON_NOT_FOUND', 'Coupon not found')

  const mapped = deserialize(query || {})
  const { page, limit, skip } = parsePagination(mapped, { defaultLimit: 50, maxLimit: 100 })
  const filter = { couponId }

  const [rows, total] = await Promise.all([
    CouponRedemption.find(filter)
      .populate('customerId', 'fullName phone email')
      .populate('orderId', 'orderNumber status paymentStatus paymentMethod paymentMode invoiceNumber')
      .populate('rolledBackBy', 'fullName email')
      .populate('couponId', 'code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CouponRedemption.countDocuments(filter),
  ])

  const items = rows.map((row) => {
    const customer = asPlainRef(row.customerId)
    const order = asPlainRef(row.orderId)
    const staff = asPlainRef(row.rolledBackBy)
    const couponDoc = asPlainRef(row.couponId)
    const status = row.status === 'rolled_back' ? 'rolled_back' : 'active'

    return {
      redemption_id: String(row._id),
      coupon_id: String(coupon.id),
      coupon_code: couponDoc?.code || coupon.code,

      customer_id: asId(row.customerId),
      customer_name: customer?.fullName ?? null,
      customer_phone: customer?.phone ?? null,
      customer_email: customer?.email ?? null,

      order_id: asId(row.orderId),
      order_number: order?.orderNumber ?? null,
      order_status: order?.status ?? null,
      payment_status: order?.paymentStatus ?? null,
      payment_method: order?.paymentMethod ?? null,
      payment_mode: order?.paymentMode ?? null,
      invoice_number: order?.invoiceNumber ?? null,

      discount_amount: Number(row.discountAmount || 0),
      created_at: row.createdAt || null,

      status,
      rolled_back_at: row.rolledBackAt || null,
      rollback_reason: row.rollbackReason || null,

      rolled_back_by: staff
        ? {
          id: String(staff._id ?? staff.id),
          full_name: staff.fullName ?? null,
          email: staff.email ?? null,
        }
        : null,
    }
  })

  return { items, ...paginationMeta(page, limit, total) }
}

export const listStaff = () => Staff.find().sort({ createdAt: 1 })
export async function createStaff(payload, actorId) {
  const input = deserialize(payload)
  if (!input.password) throw new AppError(422, 'INITIAL_PASSWORD_REQUIRED', 'An initial password is required')
  const staff = await Staff.create({ fullName: input.fullName, email: input.email, phone: input.phone, role: input.role || 'staff', passwordHash: await hashPassword(input.password), isActive: true })
  await writeAudit(actorId, 'staff.created', 'staff', staff.id, null, staff.toObject())
  return staff
}
export async function updateStaff(id, payload, actorId) {
  const before = await Staff.findById(id).select('+passwordHash')
  if (!before) throw new AppError(404, 'STAFF_NOT_FOUND', 'Staff not found')
  const input = deserialize(payload)
  const nextPassword = input.password
  delete input.password
  delete input.passwordHash
  delete input.tokenVersion
  if (before.role === 'owner' && input.role && input.role !== 'owner' && await Staff.countDocuments({ role: 'owner', isActive: true }) <= 1) throw new AppError(409, 'SOLE_OWNER', 'The only active owner cannot be demoted')
  const deactivating = input.isActive === false && before.isActive !== false
  const passwordReset = typeof nextPassword === 'string' && nextPassword.length >= 8
  const $set = { ...input }
  if (passwordReset) $set.passwordHash = await hashPassword(nextPassword)
  const bumpTokens = deactivating || passwordReset
  const staff = await Staff.findByIdAndUpdate(
    id,
    { $set, ...(bumpTokens ? { $inc: { tokenVersion: 1 } } : {}) },
    { new: true, runValidators: true },
  )
  if (bumpTokens) await revokeAllSessions(staff.id, 'staff')
  await writeAudit(actorId, 'staff.updated', 'staff', staff.id, before.toObject(), staff.toObject())
  return staff
}
export async function deleteStaff(id, actorId) {
  if (String(id) === String(actorId)) throw new AppError(409, 'SELF_DELETE', 'You cannot delete your own account')
  const staff = await Staff.findById(id)
  if (!staff) return
  if (staff.role === 'owner' && await Staff.countDocuments({ role: 'owner', isActive: true }) <= 1) throw new AppError(409, 'SOLE_OWNER', 'The only active owner cannot be deleted')
  await staff.deleteOne(); await writeAudit(actorId, 'staff.deleted', 'staff', staff.id, staff.toObject(), null)
}

export async function lowStock(query = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 50, maxLimit: 100 })
  const filter = { isActive: true, $expr: { $lte: ['$stockQty', '$lowStockThreshold'] } }
  const [items, total] = await Promise.all([
    Variant.find(filter).populate('productId').sort({ stockQty: 1, _id: 1 }).skip(skip).limit(limit),
    Variant.countDocuments(filter),
  ])
  return { items, ...paginationMeta(page, limit, total) }
}

export async function variants(query = {}) {
  const mapped = deserialize(query || {})
  const { page, limit, skip } = parsePagination(mapped, { defaultLimit: 50, maxLimit: 100 })
  const filter = {}
  if (mapped.productId) filter.productId = mapped.productId

  const stockState = mapped.stockState || mapped.stock_state || 'all'
  if (stockState === 'out_of_stock') filter.stockQty = 0
  else if (stockState === 'in_stock') {
    filter.$expr = { $gt: ['$stockQty', '$lowStockThreshold'] }
  } else if (stockState === 'low_stock') {
    filter.$and = [
      { stockQty: { $gt: 0 } },
      { $expr: { $lte: ['$stockQty', '$lowStockThreshold'] } },
    ]
  }

  const search = String(mapped.search || mapped.q || '').trim()
  if (search) {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const products = await Product.find({ name: re }).select('_id').limit(500).lean()
    filter.$or = [
      { sku: re },
      { label: re },
      { productId: { $in: products.map((row) => row._id) } },
    ]
  }

  const [items, total] = await Promise.all([
    Variant.find(filter).populate('productId').sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit),
    Variant.countDocuments(filter),
  ])
  return { items, ...paginationMeta(page, limit, total) }
}
export const adjustStock = (variantId, delta, reason, note, actorId, opts) => inventoryService.adjustStock(variantId, delta, reason, note, actorId, opts)
export const setStock = (variantId, input, actorId) => inventoryService.setStock(variantId, { ...input, actorId })
export const stockLedger = (query = {}) => inventoryService.stockLedger(query)
export async function paymentEvents(query = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 50, maxLimit: 100 })
  const [items, total] = await Promise.all([
    PaymentEvent.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    PaymentEvent.countDocuments(),
  ])
  return { items, ...paginationMeta(page, limit, total) }
}
export async function auditLog(query = {}) {
  const filter = query.action ? { action: query.action } : {}
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 50, maxLimit: 100 })
  const [items, total] = await Promise.all([
    AuditLog.find(filter).populate('actorId').sort({ createdAt: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ])
  return { items, ...paginationMeta(page, limit, total) }
}

export function writeAudit(actorId, action, entityType, entityId, before, after, metadata = {}) { return AuditLog.create({ actorId, action, entityType, entityId, before, after, metadata }) }
export const products = () => Product.find().sort({ createdAt: -1 })
