import { z } from 'zod'

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id')

/** Treat blank / sentinel filter values as “no filter”. */
export function emptyToUndefined(value) {
  if (value == null) return undefined
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed || trimmed.toLowerCase() === 'all') return undefined
    return trimmed
  }
  return value
}

const optionalString = z.preprocess(emptyToUndefined, z.string().max(500).optional())
const optionalObjectId = z.preprocess(emptyToUndefined, objectId.optional())

export const booleanQuery = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined
  if (value === true || value === false) return value
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  return value
}, z.boolean().optional())

export const dateQuery = z.preprocess(emptyToUndefined, z.coerce.date().optional())

export const paginationQuerySchema = z.object({
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).optional().default(1)),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).optional().default(50)),
  search: optionalString,
}).strip()

export const sortDirectionSchema = z.preprocess(
  emptyToUndefined,
  z.enum(['asc', 'desc']).optional().default('desc'),
)

export const catalogResourceEnum = z.enum([
  'categories',
  'brands',
  'products',
  'variants',
  'images',
  'stones',
  'certificates',
  'banners',
  'cms-pages',
])

export const idParamSchema = z.object({ id: objectId }).strip()
export const resourceParamSchema = z.object({ resource: catalogResourceEnum }).strip()
export const resourceIdParamSchema = z.object({
  resource: catalogResourceEnum,
  id: z.string().min(1).max(200),
}).strip()

/** Admin / customer list filters used across commerce endpoints. */
export const listFiltersQuerySchema = paginationQuerySchema.extend({
  status: optionalString,
  payment_status: optionalString,
  paymentStatus: optionalString,
  customer_id: optionalObjectId,
  customerId: optionalObjectId,
  category_id: optionalObjectId,
  categoryId: optionalObjectId,
  brand_id: optionalObjectId,
  brandId: optionalObjectId,
  product_id: optionalObjectId,
  productId: optionalObjectId,
  variant_id: optionalObjectId,
  variantId: optionalObjectId,
  date_from: dateQuery,
  dateFrom: dateQuery,
  date_to: dateQuery,
  dateTo: dateQuery,
  from: dateQuery,
  to: dateQuery,
  reason: optionalString,
  action: optionalString,
  reference_type: optionalString,
  referenceType: optionalString,
  reference_id: optionalObjectId,
  referenceId: optionalObjectId,
  hydrate: booleanQuery,
  is_featured: booleanQuery,
  isFeatured: booleanQuery,
  is_active: booleanQuery,
  isActive: booleanQuery,
  sort: optionalString,
  direction: sortDirectionSchema,
}).strip()

export const orderListQuerySchema = listFiltersQuerySchema
export const customerListQuerySchema = paginationQuerySchema.extend({
  status: optionalString,
  search: optionalString,
}).strip()

export const stockLedgerQuerySchema = paginationQuerySchema.extend({
  reason: optionalString,
  search: optionalString,
  reference_type: optionalString,
  referenceType: optionalString,
  reference_id: optionalObjectId,
  referenceId: optionalObjectId,
}).strip()

export const catalogListQuerySchema = listFiltersQuerySchema.extend({
  position: optionalString,
  slug: optionalString,
  is_published: booleanQuery,
  isPublished: booleanQuery,
  applicable_variant_id: optionalObjectId,
  applicableVariantId: optionalObjectId,
}).strip()

export const inventoryListQuerySchema = listFiltersQuerySchema.extend({
  search: optionalString,
  q: optionalString,
  stock_state: z.enum(['all', 'low_stock', 'out_of_stock', 'in_stock']).optional(),
  stockState: z.enum(['all', 'low_stock', 'out_of_stock', 'in_stock']).optional(),
}).strip()

export const reportQuerySchema = z.object({
  from: dateQuery,
  to: dateQuery,
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).optional()),
}).strip()

export const returnsListQuerySchema = z.object({
  status: optionalString,
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).optional()),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).optional()),
}).strip()

export const reviewsListQuerySchema = returnsListQuerySchema

export const auditLogQuerySchema = paginationQuerySchema.extend({
  action: optionalString,
}).strip()
