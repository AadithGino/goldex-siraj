import { z } from 'zod'
import { objectId, storageKeyString } from './common.schemas.js'

export const JEWELLERY_TYPES = ['ring', 'necklace', 'bracelet', 'earring', 'bangle', 'pendant', 'other']
export const METAL_COLORS = ['yellow', 'white', 'rose']
export const CUSTOM_REQUEST_STATUSES = ['submitted', 'quoted', 'accepted', 'declined', 'cancelled', 'completed']

export const customRequestCreateBody = z.object({
  jewellery_type: z.enum(JEWELLERY_TYPES),
  purity: z.enum(['14k', '18k', '21k', '22k', '24k', '14K', '18K', '21K', '22K', '24K']),
  metal_color: z.enum(METAL_COLORS).optional().default('yellow'),
  gold_weight_grams: z.coerce.number().finite().gt(0).max(500),
  size_label: z.string().trim().max(80).optional().default(''),
  description: z.string().trim().min(10).max(2000),
  budget_aed: z.union([z.coerce.number().finite().min(0).max(10_000_000), z.null()]).optional(),
  image_keys: z.array(storageKeyString).min(1).max(5),
}).strict()

export const customRequestIdParamSchema = z.object({ id: objectId })

export const customRequestListQuerySchema = z.object({
  status: z.enum([...CUSTOM_REQUEST_STATUSES, 'all']).optional(),
}).strip()

export const customRequestQuoteBody = z.object({
  making_charge_type: z.enum(['percent', 'flat']),
  making_charge_value: z.coerce.number().finite().min(0).max(1_000_000),
  wastage_percent: z.coerce.number().finite().min(0).max(100),
  stone_charge: z.coerce.number().finite().min(0).max(1_000_000).optional().default(0),
  admin_notes: z.string().trim().max(2000).optional().default(''),
  valid_days: z.coerce.number().int().min(1).max(90).optional().default(7),
}).strict()

export const customRequestDeclineBody = z.object({
  reason: z.string().trim().max(1000).optional().default(''),
}).strict()

export const customRequestCompleteBody = z.object({
  note: z.string().trim().max(1000).optional().default(''),
}).strict()
