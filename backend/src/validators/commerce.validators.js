import { z } from 'zod'
import { envelope, objectId } from './order.validators.js'
import { listFiltersQuerySchema } from './common.schemas.js'
import { resolveAliasGroup } from './alias.js'

export const goldRateSchema = envelope(z.object({
  purity: z.string().trim().min(1).max(32),
  rate_per_gram: z.coerce.number().finite().positive().max(1_000_000).optional(),
  ratePerGram: z.coerce.number().finite().positive().max(1_000_000).optional(),
  note: z.string().trim().max(500).nullable().optional(),
}).strict().refine((row) => row.rate_per_gram != null || row.ratePerGram != null, {
  message: 'rate_per_gram is required',
}))

export const stoneRateSchema = envelope(z.object({
  stone_type: z.string().trim().min(1).max(120).optional(),
  stoneType: z.string().trim().min(1).max(120).optional(),
  grade: z.string().trim().max(80).nullable().optional(),
  unit: z.enum(['carat', 'piece']).optional(),
  rate: z.coerce.number().finite().positive().max(1_000_000),
  note: z.string().trim().max(500).nullable().optional(),
}).strict().refine((row) => row.stone_type || row.stoneType, {
  message: 'stone_type is required',
}))

const couponIsoInstant = z.union([
  z.null(),
  z.string().trim().min(1).refine(
    (value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value),
    { message: 'Must be ISO-8601 with timezone offset (e.g. 2026-07-21T14:00:00.000Z)' },
  ),
])

const COUPON_ALIAS_GROUPS = [
  ['discount_type', 'discountType', 'type'],
  ['discount_value', 'discountValue', 'value'],
  ['min_order', 'minOrder', 'min_order_amount', 'minOrderAmount'],
  ['max_discount', 'maxDiscount'],
  ['usage_limit', 'usageLimit'],
  ['per_customer_limit', 'perCustomerLimit'],
  ['valid_from', 'validFrom', 'starts_at', 'startsAt'],
  ['valid_to', 'validTo', 'ends_at', 'endsAt'],
  ['is_active', 'isActive'],
]

function rejectCouponAliasConflicts(body, ctx) {
  for (const keys of COUPON_ALIAS_GROUPS) {
    try {
      resolveAliasGroup(body, keys)
    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) ctx.addIssue(issue)
      } else {
        throw error
      }
    }
  }
}

function rejectPercentOver100(body, ctx) {
  const type = body.discount_type ?? body.discountType ?? body.type
  const value = body.discount_value ?? body.discountValue ?? body.value
  if (type === 'percent' && value != null && Number(value) > 100) {
    ctx.addIssue({
      code: 'custom',
      message: 'percent discount_value cannot exceed 100',
      path: ['discount_value'],
    })
  }
}

const couponBodyFields = {
  code: z.string().trim().min(1).max(64).optional(),
  discount_type: z.enum(['percent', 'flat']).optional(),
  discountType: z.enum(['percent', 'flat']).optional(),
  type: z.enum(['percent', 'flat']).optional(),
  discount_value: z.coerce.number().finite().positive().max(1_000_000).optional(),
  discountValue: z.coerce.number().finite().positive().max(1_000_000).optional(),
  value: z.coerce.number().finite().positive().max(1_000_000).optional(),
  min_order: z.coerce.number().finite().min(0).optional(),
  min_order_amount: z.coerce.number().finite().min(0).optional(),
  minOrderAmount: z.coerce.number().finite().min(0).optional(),
  minOrder: z.coerce.number().finite().min(0).optional(),
  max_discount: z.coerce.number().finite().positive().max(1_000_000).nullable().optional(),
  maxDiscount: z.coerce.number().finite().positive().max(1_000_000).nullable().optional(),
  usage_limit: z.coerce.number().int().positive().nullable().optional(),
  usageLimit: z.coerce.number().int().positive().nullable().optional(),
  per_customer_limit: z.coerce.number().int().positive().optional(),
  perCustomerLimit: z.coerce.number().int().positive().optional(),
  valid_from: couponIsoInstant.optional(),
  validFrom: couponIsoInstant.optional(),
  valid_to: couponIsoInstant.optional(),
  validTo: couponIsoInstant.optional(),
  starts_at: couponIsoInstant.optional(),
  startsAt: couponIsoInstant.optional(),
  ends_at: couponIsoInstant.optional(),
  endsAt: couponIsoInstant.optional(),
  is_active: z.boolean().optional(),
  isActive: z.boolean().optional(),
}

const couponBodyBase = z.object(couponBodyFields).strict()
  .superRefine(rejectCouponAliasConflicts)
  .superRefine(rejectPercentOver100)

export const couponCreateBody = couponBodyBase.superRefine((body, ctx) => {
  if (!body.code) ctx.addIssue({ code: 'custom', message: 'code is required', path: ['code'] })
  const type = body.discount_type ?? body.discountType ?? body.type
  const value = body.discount_value ?? body.discountValue ?? body.value
  if (!type) ctx.addIssue({ code: 'custom', message: 'discount_type is required', path: ['discount_type'] })
  if (value == null) ctx.addIssue({ code: 'custom', message: 'discount_value is required', path: ['discount_value'] })
})

export const couponUpdateBody = couponBodyBase.superRefine((body, ctx) => {
  if (!body || Object.keys(body).length === 0) {
    ctx.addIssue({ code: 'custom', message: 'At least one field is required', path: [] })
  }
})

/** @deprecated Prefer couponCreateBody / couponUpdateBody via validateRequest. */
export const couponWriteSchema = {
  params: z.object({ id: objectId.optional() }),
  body: couponBodyBase,
}

export const couponCreateSchema = { body: couponCreateBody }
export const couponUpdateSchema = {
  params: z.object({ id: objectId }),
  body: couponUpdateBody,
}

export const schemeEnrollSchema = {
  body: z.object({
    scheme_id: objectId,
  }).strict(),
}

const SCHEME_PAY_METHODS = z.enum(['cash', 'bank_transfer', 'card'])

const installmentPayBody = z.object({
  amount: z.number().finite().positive().max(1_000_000),
  payment_method: SCHEME_PAY_METHODS.optional(),
  paymentMethod: SCHEME_PAY_METHODS.optional(),
  payment_mode: SCHEME_PAY_METHODS.optional(),
  paymentMode: SCHEME_PAY_METHODS.optional(),
  transaction_ref: z.string().trim().max(200).nullable().optional(),
  transactionRef: z.string().trim().max(200).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
}).strict().superRefine((body, ctx) => {
  try {
    resolveAliasGroup(body, ['payment_method', 'paymentMethod', 'payment_mode', 'paymentMode'])
    resolveAliasGroup(body, ['transaction_ref', 'transactionRef'])
  } catch (error) {
    if (error instanceof z.ZodError) {
      for (const issue of error.issues) ctx.addIssue(issue)
    } else throw error
  }
  const method = body.payment_method ?? body.paymentMethod ?? body.payment_mode ?? body.paymentMode
  if (!method) {
    ctx.addIssue({ code: 'custom', message: 'payment_method is required', path: ['payment_method'] })
  }
  const ref = body.transaction_ref ?? body.transactionRef
  const hasRef = ref != null && String(ref).trim() !== ''
  if ((method === 'bank_transfer' || method === 'card') && !hasRef) {
    ctx.addIssue({
      code: 'custom',
      message: 'transaction_ref is required for bank_transfer and card',
      path: ['transaction_ref'],
    })
  }
})

export const installmentPaySchema = {
  params: z.object({
    id: objectId.optional(),
    installmentId: objectId,
  }),
  body: installmentPayBody,
}

const schemeBodyFields = {
  name: z.string().trim().min(1).max(200).optional(),
  name_ar: z.string().trim().max(200).nullable().optional(),
  nameAr: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  description_ar: z.string().trim().max(5000).nullable().optional(),
  descriptionAr: z.string().trim().max(5000).nullable().optional(),
  monthly_amount: z.number().finite().positive().max(1_000_000).optional(),
  monthlyAmount: z.number().finite().positive().max(1_000_000).optional(),
  tenure_months: z.number().int().min(1).max(120).optional(),
  tenureMonths: z.number().int().min(1).max(120).optional(),
  bonus_months: z.number().int().min(0).max(24).optional(),
  bonusMonths: z.number().int().min(0).max(24).optional(),
  is_active: z.boolean().optional(),
  isActive: z.boolean().optional(),
  terms: z.string().trim().max(10_000).nullable().optional(),
  terms_ar: z.string().trim().max(10_000).nullable().optional(),
  termsAr: z.string().trim().max(10_000).nullable().optional(),
}

const schemeAliasGroups = [
  ['name_ar', 'nameAr'],
  ['description_ar', 'descriptionAr'],
  ['monthly_amount', 'monthlyAmount'],
  ['tenure_months', 'tenureMonths'],
  ['bonus_months', 'bonusMonths'],
  ['is_active', 'isActive'],
  ['terms_ar', 'termsAr'],
]

function rejectSchemeAliasConflicts(body, ctx) {
  for (const keys of schemeAliasGroups) {
    try {
      resolveAliasGroup(body, keys)
    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) ctx.addIssue(issue)
      } else throw error
    }
  }
}

const schemeBodyBase = z.object(schemeBodyFields).strict().superRefine(rejectSchemeAliasConflicts)

export const schemeCreateBody = schemeBodyBase.superRefine((body, ctx) => {
  if (!body.name) ctx.addIssue({ code: 'custom', message: 'name is required', path: ['name'] })
  if (body.monthly_amount == null && body.monthlyAmount == null) {
    ctx.addIssue({ code: 'custom', message: 'monthly_amount is required', path: ['monthly_amount'] })
  }
  if (body.tenure_months == null && body.tenureMonths == null) {
    ctx.addIssue({ code: 'custom', message: 'tenure_months is required', path: ['tenure_months'] })
  }
})

export const schemeUpdateBody = schemeBodyBase.superRefine((body, ctx) => {
  if (!body || Object.keys(body).length === 0) {
    ctx.addIssue({ code: 'custom', message: 'At least one field is required', path: [] })
  }
})

export const schemeCreateSchema = { body: schemeCreateBody }
export const schemeUpdateSchema = {
  params: z.object({ id: objectId }),
  body: schemeUpdateBody,
}

export const schemeCancelSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    status: z.literal('cancelled'),
    reason: z.string().trim().max(2000).nullable().optional(),
  }).strict(),
}

export const schemeCompleteSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    note: z.string().trim().max(2000).nullable().optional(),
    resolution_note: z.string().trim().max(2000).nullable().optional(),
  }).strict(),
}

export const schemeListQuerySchema = listFiltersQuerySchema
export const enrollmentListQuerySchema = listFiltersQuerySchema
export const enrollmentIdParamSchema = z.object({ id: objectId })

/** @deprecated Legacy envelope form — prefer installmentPaySchema validateRequest config. */
export const installmentPayEnvelopeSchema = envelope(
  installmentPayBody,
  z.object({ id: objectId.optional(), installmentId: objectId }),
)

export const reviewSubmitSchema = envelope(z.object({
  product_id: objectId,
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(200).optional(),
  /** Canonical field persisted on Review.comment */
  comment: z.string().trim().max(5000).optional(),
  /** Legacy alias — normalized to comment */
  body: z.string().trim().max(5000).optional(),
}).strict().superRefine((row, ctx) => {
  if (row.comment != null && row.body != null && row.comment !== row.body) {
    ctx.addIssue({
      code: 'custom',
      message: 'comment and body must match when both are sent',
      path: ['comment'],
    })
  }
}).transform((row) => ({
  product_id: row.product_id,
  rating: row.rating,
  title: row.title,
  comment: row.comment ?? row.body,
})))

export const reviewModerateSchema = envelope(
  z.object({
    status: z.enum(['approved', 'rejected', 'pending']),
  }).strict(),
  z.object({ id: objectId }),
)

export const staffWriteSchema = envelope(z.object({
  full_name: z.string().trim().min(1).max(200).optional(),
  fullName: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email().max(200).optional(),
  password: z.string().min(10).max(200).optional(),
  role: z.enum(['manager', 'staff', 'viewer']).optional(),
  is_active: z.boolean().optional(),
  isActive: z.boolean().optional(),
}).strict())

export const customerUpdateSchema = envelope(
  z.object({
    full_name: z.string().trim().max(200).nullable().optional(),
    fullName: z.string().trim().max(200).nullable().optional(),
    email: z.string().trim().email().max(200).nullable().optional(),
    is_active: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }).strict(),
  z.object({ id: objectId }),
)

export const addressWriteSchema = envelope(
  z.object({
    label: z.string().trim().min(1).max(40).optional(),
    recipient_name: z.string().trim().min(2).max(200).optional(),
    recipientName: z.string().trim().min(2).max(200).optional(),
    phone: z.string().trim().min(8).max(20).optional(),
    line1: z.string().trim().min(3).max(300).optional(),
    line2: z.string().trim().max(300).nullable().optional(),
    city: z.string().trim().min(1).max(120).optional(),
    state: z.string().trim().min(1).max(120).optional(),
    pincode: z.string().trim().max(20).nullable().optional(),
    country: z.string().trim().min(1).max(120).optional(),
    latitude: z.coerce.number().finite().nullable().optional(),
    longitude: z.coerce.number().finite().nullable().optional(),
    is_default: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  }),
  z.object({ id: objectId.optional() }),
)
