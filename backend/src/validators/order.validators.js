import { z } from 'zod'
import { listFiltersQuerySchema, objectId as sharedObjectId } from './common.schemas.js'
import { finiteNumber } from './numeric.js'

export const objectId = sharedObjectId

/** @deprecated Prefer validateRequest({ body, params, query }) configs. Kept for mutation schemas. */
export const envelope = (body, params = z.object({}).passthrough(), query = z.object({}).passthrough()) => z.object({
  body,
  params,
  query,
})

export const placeOrderSchema = envelope(z.object({
  address_id: objectId,
  payment_method: z.enum(['cod', 'manual']),
  wallet_use: z.coerce.number().finite().min(0).max(1_000_000).optional().default(0),
  coupon_code: z.string().trim().max(64).nullable().optional(),
  idempotency_key: z.string().trim().min(8).max(128),
  is_gift: z.boolean().optional().default(false),
  gift_note: z.string().trim().max(500).nullable().optional(),
}))

export const requestReturnSchema = envelope(z.object({
  order_id: objectId,
  kind: z.enum(['cancellation', 'return']),
  order_item_id: objectId.nullable().optional(),
  requested_qty: z.coerce.number().int().positive().max(10_000).nullable().optional(),
  qty: z.coerce.number().int().positive().max(10_000).nullable().optional(),
  reason: z.string().trim().max(1000).optional(),
  proof_urls: z.array(z.string().trim().min(1).max(2048)).max(10).optional(),
  proof_keys: z.array(z.string().trim().min(1).max(512)).max(10).optional(),
}))

export const resolveReturnSchema = envelope(
  z.object({
    status: z.enum(['approved', 'rejected', 'completed']),
    resolution_note: z.string().trim().max(2000).nullable().optional(),
  }),
  z.object({ id: objectId }),
)

/** Query-only config for paginated GET endpoints (no body validation). */
export const paginationQuerySchema = { query: listFiltersQuerySchema }

export const updateOrderStatusSchema = envelope(
  z.object({
    status: z.enum(['confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
    note: z.string().trim().max(2000).nullable().optional(),
  }).strict(),
  z.object({ id: objectId }),
)

export const codHandoverSchema = envelope(
  z.object({
    note: z.string().trim().max(2000).nullable().optional(),
    amount: z.coerce.number().finite().positive().optional(),
    amount_collected: z.coerce.number().finite().positive().optional(),
    amountCollected: z.coerce.number().finite().positive().optional(),
  }).strict().transform((body) => {
    const amount = body.amount ?? body.amount_collected ?? body.amountCollected
    if (amount == null) {
      throw new z.ZodError([{ code: 'custom', message: 'amount_collected is required', path: ['amount_collected'] }])
    }
    return { note: body.note, amount }
  }),
  z.object({ id: objectId }),
)

export const manualPaymentSchema = envelope(
  z.object({
    payment_mode: z.enum(['bank_transfer', 'card']),
    transaction_ref: z.string().trim().min(1).max(200),
    amount: z.coerce.number().finite().positive().optional(),
    amount_collected: z.coerce.number().finite().positive().optional(),
    amountCollected: z.coerce.number().finite().positive().optional(),
    note: z.string().trim().max(2000).nullable().optional(),
  }).strict().transform((body) => {
    const amount = body.amount ?? body.amount_collected ?? body.amountCollected
    if (amount == null) {
      throw new z.ZodError([{ code: 'custom', message: 'amount_collected is required', path: ['amount_collected'] }])
    }
    return {
      payment_mode: body.payment_mode,
      transaction_ref: body.transaction_ref,
      note: body.note,
      amount,
    }
  }),
  z.object({ id: objectId }),
)

export const stockAdjustSchema = envelope(
  z.object({
    delta: z.coerce.number().int().refine((n) => n !== 0, 'delta must be non-zero'),
    reason: z.enum(['admin_adjustment', 'stock_import', 'stock_correction']).optional(),
    note: z.string().trim().max(500).nullable().optional(),
    idempotency_key: z.string().trim().min(8).max(128),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  }).strict().transform((body) => ({
    delta: body.delta,
    reason: body.reason || 'admin_adjustment',
    note: body.note,
    idempotency_key: body.idempotency_key || body.idempotencyKey,
  })),
  z.object({ id: objectId }),
)

export const setStockSchema = envelope(
  z.object({
    qty: finiteNumber(z.number().int().min(0).max(1_000_000)),
    expected_before: finiteNumber(z.number().int().min(0)).optional(),
    expectedBefore: finiteNumber(z.number().int().min(0)).optional(),
    reason: z.enum(['admin_adjustment', 'stock_import', 'stock_correction']).optional(),
    note: z.string().trim().max(500).nullable().optional(),
    idempotency_key: z.string().trim().min(8).max(128),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  }).strict().superRefine((body, ctx) => {
    if (body.expected_before == null && body.expectedBefore == null) {
      ctx.addIssue({ code: 'custom', message: 'expected_before is required', path: ['expected_before'] })
    }
  }).transform((body) => ({
    qty: body.qty,
    expected_before: body.expected_before ?? body.expectedBefore,
    reason: body.reason || 'admin_adjustment',
    note: body.note,
    idempotency_key: body.idempotency_key || body.idempotencyKey,
  })),
  z.object({ id: objectId }),
)

const customizationString = z.string().trim().max(1000).nullable()

function resolveCartCustomization(body) {
  const hasSnake = Object.prototype.hasOwnProperty.call(body, 'customization_request')
  const hasCamel = Object.prototype.hasOwnProperty.call(body, 'customizationRequest')
  if (hasSnake && hasCamel) {
    const a = body.customization_request
    const b = body.customizationRequest
    const same = a === b
      || (a == null && b == null)
      || (typeof a === 'string' && typeof b === 'string' && a.trim() === b.trim())
    if (!same) {
      throw new z.ZodError([{
        code: 'custom',
        message: 'customization_request and customizationRequest must match when both are sent',
        path: ['customization_request'],
      }])
    }
    return a
  }
  if (hasSnake) return body.customization_request
  if (hasCamel) return body.customizationRequest
  return undefined
}

function normalizeCartCustomizationValue(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new z.ZodError([{
      code: 'custom',
      message: 'customization_request must be a string or null',
      path: ['customization_request'],
    }])
  }
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > 1000) {
    throw new z.ZodError([{
      code: 'custom',
      message: 'customization_request must be at most 1000 characters',
      path: ['customization_request'],
    }])
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(trimmed)) { // eslint-disable-line no-control-regex -- intentional C0 control rejection
    throw new z.ZodError([{
      code: 'custom',
      message: 'customization_request contains unsupported control characters',
      path: ['customization_request'],
    }])
  }
  return trimmed
}

export const cartAddSchema = {
  body: z.object({
    variant_id: objectId,
    qty: z.coerce.number().int().positive().max(10_000).optional().default(1),
    customization_request: customizationString.optional(),
    customizationRequest: customizationString.optional(),
  }).strict().transform((body) => {
    const customization_request = normalizeCartCustomizationValue(resolveCartCustomization(body))
    return {
      variant_id: body.variant_id,
      qty: body.qty,
      ...(customization_request !== undefined ? { customization_request } : {}),
    }
  }),
}

export const cartUpdateSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    qty: z.coerce.number().int().positive().max(10_000).optional(),
    variant_id: objectId.optional(),
    customization_request: customizationString.optional(),
    customizationRequest: customizationString.optional(),
  }).strict().superRefine((body, ctx) => {
    const hasQty = body.qty !== undefined
    const hasVariant = body.variant_id !== undefined
    const hasCustom = Object.prototype.hasOwnProperty.call(body, 'customization_request')
      || Object.prototype.hasOwnProperty.call(body, 'customizationRequest')
    if (!hasQty && !hasVariant && !hasCustom) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one of qty, variant_id, or customization_request is required',
        path: [],
      })
    }
  }).transform((body) => {
    const customization_request = normalizeCartCustomizationValue(resolveCartCustomization(body))
    const out = {}
    if (body.qty !== undefined) out.qty = body.qty
    if (body.variant_id !== undefined) out.variant_id = body.variant_id
    if (customization_request !== undefined) out.customization_request = customization_request
    return out
  }),
}

export const wishlistAddSchema = {
  body: z.object({
    product_id: objectId,
  }).strict(),
}

export const couponValidateSchema = {
  body: z.object({
    code: z.string().trim().min(1).max(64),
    order_total: z.coerce.number().finite().min(0).optional(),
  }).strict(),
}

export const cartQuoteSchema = {
  body: z.object({
    coupon_code: z.string().trim().min(1).max(64).nullable().optional(),
  }).strict(),
}
