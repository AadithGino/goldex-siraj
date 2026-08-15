import { z } from 'zod'
import { objectId, optionalStorageKeyString, storageKeyString } from './common.schemas.js'

export const SELL_JEWELLERY_TYPES = ['ring', 'necklace', 'bracelet', 'earring', 'bangle', 'pendant', 'other']
export const SELL_REQUEST_STATUSES = [
  'submitted',
  'needs_info',
  'offered',
  'accepted',
  'declined',
  'cancelled',
  'completed',
]

const PURITIES = ['14k', '18k', '21k', '22k', '24k', '14K', '18K', '21K', '22K', '24K']

const optionalCoord = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.union([z.null(), z.coerce.number().finite()]),
)

const pickupAddressSchema = z.object({
  recipient_name: z.string().trim().min(2).max(200),
  phone: z.string().trim().min(8).max(20),
  line1: z.string().trim().min(3).max(300),
  line2: z.string().trim().max(300).optional().default(''),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(120),
  pincode: z.string().trim().max(20).optional().default(''),
  country: z.string().trim().min(1).max(120).optional().default('United Arab Emirates'),
  latitude: optionalCoord.refine((value) => value == null || (value >= -90 && value <= 90), {
    message: 'Latitude must be between -90 and 90',
  }).optional(),
  longitude: optionalCoord.refine((value) => value == null || (value >= -180 && value <= 180), {
    message: 'Longitude must be between -180 and 180',
  }).optional(),
}).strict()

export const sellRequestCreateBody = z.object({
  jewellery_type: z.enum(SELL_JEWELLERY_TYPES).optional().default('other'),
  purity: z.enum(PURITIES),
  net_weight_grams: z.coerce.number().finite().gt(0).max(5000),
  notes: z.string().trim().max(2000).optional().default(''),
  image_keys: z.array(storageKeyString).min(1).max(5),
  invoice_key: optionalStorageKeyString,
  pickup_address: pickupAddressSchema,
}).strict()

export const sellRequestIdParamSchema = z.object({ id: objectId })

export const sellRequestListQuerySchema = z.object({
  status: z.enum([...SELL_REQUEST_STATUSES, 'all']).optional(),
}).strip()

export const sellRequestOfferBody = z.object({
  net_weight_grams: z.coerce.number().finite().gt(0).max(5000).optional(),
  rate_per_gram: z.coerce.number().finite().positive().max(1_000_000).optional(),
  admin_notes: z.string().trim().max(2000).optional().default(''),
  valid_days: z.coerce.number().int().min(1).max(90).optional().default(7),
}).strict()

export const sellRequestDeclineBody = z.object({
  reason: z.string().trim().max(1000).optional().default(''),
}).strict()

export const sellRequestCompleteBody = z.object({
  note: z.string().trim().max(1000).optional().default(''),
}).strict()

export const sellRequestInfoBody = z.object({
  message: z.string().trim().min(4).max(2000),
}).strict()

export const sellRequestReplyBody = z.object({
  message: z.string().trim().min(4).max(2000),
  image_keys: z.array(storageKeyString).max(5).optional().default([]),
}).strict()
