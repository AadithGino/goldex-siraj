import { createHash } from 'node:crypto'
import mongoose from 'mongoose'
import { Banner, Brand, Category, Certificate, CmsPage, Product, ProductImage, ProductStone, StoreSetting, TaxSetting, Variant } from '../models/catalog.models.js'
import { GoldRate, StoneRate } from '../models/rate.models.js'
import { AppError } from '../utils/AppError.js'
import { sanitizeCmsHtml } from '../utils/htmlSanitize.js'
import { paginationMeta, parsePagination } from '../utils/pagination.js'
import { deserialize } from '../utils/serialize.js'
import { assertVariantWeights } from './address.dto.js'
import { assertCatalogWriteNotEmpty, toCatalogWriteDto } from './catalog.dto.js'
import { applyStockDelta } from './inventory.service.js'
import { stableStringify } from '../validators/numeric.js'

function isDuplicateKey(error) {
  return error?.code === 11000 || error?.cause?.code === 11000
}

/** Resolve stock mutation idempotency key from request body. */
function resolveStockIdempotencyKey(body, { required = false } = {}) {
  const explicit = body.stockIdempotencyKey || body.stock_idempotency_key
  if (explicit != null && String(explicit).trim()) return String(explicit).trim()
  const base = body.idempotencyKey || body.idempotency_key
  if (base != null && String(base).trim()) return `${String(base).trim()}:stock`
  if (required) {
    throw new AppError(422, 'IDEMPOTENCY_REQUIRED', 'Stock mutation requires an idempotency key')
  }
  return null
}

const resources = {
  categories: Category,
  brands: Brand,
  products: Product,
  variants: Variant,
  images: ProductImage,
  stones: ProductStone,
  certificates: Certificate,
  banners: Banner,
  'cms-pages': CmsPage,
}

export const getResourceModel = (resource) => {
  const Model = resources[resource]
  if (!Model) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Catalog resource not found')
  return Model
}

export async function list(resource, query = {}, admin = false) {
  const Model = getResourceModel(resource)
  const filter = {}
  if (!admin) {
    if (resource === 'products') filter.status = 'active'
    if (['categories', 'brands', 'banners'].includes(resource)) filter.isActive = true
    if (resource === 'variants') filter.isActive = true
    if (resource === 'cms-pages') filter.isPublished = true
    if (resource === 'banners') {
      filter.$and = [
        { $or: [{ startsAt: null }, { startsAt: { $lte: new Date() } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: new Date() } }] },
      ]
    }
  }
  const mapped = deserialize(query)

  if (resource === 'certificates' && !admin) {
    // Public applicable-certificate list: product_id required.
    // Without applicable_variant_id → all certificates for the product.
    // With applicable_variant_id → product-wide (variantId null) + that variant only.
    if (!mapped.productId) {
      throw new AppError(422, 'PRODUCT_ID_REQUIRED', 'product_id is required for public certificate list')
    }
    filter.productId = mapped.productId
    if (mapped.applicableVariantId) {
      const variant = await Variant.findById(mapped.applicableVariantId).select('_id productId')
      if (!variant || String(variant.productId) !== String(mapped.productId)) {
        throw new AppError(422, 'VARIANT_PRODUCT_MISMATCH', 'Variant does not belong to the requested product')
      }
      filter.$or = [
        { variantId: null },
        { variantId: mapped.applicableVariantId },
      ]
    }
  } else {
    for (const key of ['categoryId', 'brandId', 'productId', 'variantId', 'position', 'slug', 'status', 'isFeatured', 'isPublished']) {
      if (mapped[key] !== undefined && mapped[key] !== '' && mapped[key] !== 'all') filter[key] = mapped[key]
    }
  }

  if (mapped.isActive === true || mapped.isActive === false) filter.isActive = mapped.isActive
  if (mapped.search && ['products', 'brands', 'categories'].includes(resource)) {
    filter.$or = [
      { name: new RegExp(String(mapped.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { slug: new RegExp(String(mapped.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
    ]
  }
  const { page, limit, skip } = parsePagination(mapped, { defaultLimit: 50, maxLimit: 100 })
  const [rows, total] = await Promise.all([
    Model.find(filter).sort({ displayOrder: 1, createdAt: -1 }).skip(skip).limit(limit),
    Model.countDocuments(filter),
  ])
  const hydrate = String(mapped.hydrate || '') === '1' || mapped.hydrate === true || mapped.hydrate === 'true'
  let items = hydrate && resource === 'products'
    ? await Promise.all(rows.map((row) => hydrateProduct(row, admin)))
    : rows
  if (resource === 'cms-pages') {
    items = items.map((row) => {
      const plain = row.toObject ? row.toObject() : row
      return {
        ...plain,
        content: sanitizeCmsHtml(plain.content || ''),
        contentAr: plain.contentAr == null ? null : sanitizeCmsHtml(plain.contentAr),
      }
    })
  }
  if (resource === 'certificates' && !admin) {
    items = items.map((row) => toPublicCertificate(row))
  }
  return { items, ...paginationMeta(page, limit, total) }
}

async function hydrateProduct(item, admin = false) {
  const productId = item.id || item._id
  const [variants, images, certificates, category, brand] = await Promise.all([
    Variant.find({ productId, ...(admin ? {} : { isActive: true }) }).sort({ weightGrams: 1 }),
    ProductImage.find({ productId }).sort({ displayOrder: 1 }),
    Certificate.find({ productId }),
    item.categoryId ? Category.findById(item.categoryId) : null,
    item.brandId ? Brand.findById(item.brandId) : null,
  ])
  const stones = await ProductStone.find({ variantId: { $in: variants.map((row) => row.id) } }).sort({ displayOrder: 1 })
  const stonesByVariant = new Map()
  for (const stone of stones) {
    const key = String(stone.variantId)
    if (!stonesByVariant.has(key)) stonesByVariant.set(key, [])
    stonesByVariant.get(key).push(stone)
  }
  const variantsWithStones = variants.map((variant) => ({
    ...variant.toObject(),
    product_stones: stonesByVariant.get(String(variant.id)) || [],
  }))
  const imageRows = images.map((image) => (image.toObject ? image.toObject() : image))
  return {
    ...item.toObject(),
    variants: variantsWithStones,
    images: imageRows,
    product_variants: variantsWithStones,
    product_images: imageRows,
    certificates: admin ? certificates : certificates.map((c) => toPublicCertificate(c)),
    category,
    brand,
    categories: category,
    brands: brand,
    occasions: item.occasion || [],
    primary_image: imageRows.find((image) => image.isPrimary)?.imageUrl || imageRows[0]?.imageUrl || null,
    has_certificate: certificates.length > 0,
  }
}

export async function getOne(resource, idOrSlug, admin = false) {
  const Model = getResourceModel(resource)
  const selector = /^[a-f\d]{24}$/i.test(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug }
  if (!admin && resource === 'products') selector.status = 'active'
  if (!admin && resource === 'cms-pages') selector.isPublished = true
  const item = await Model.findOne(selector)
  if (!item) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Resource not found')
  if (resource === 'products') return hydrateProduct(item, admin)
  if (resource === 'cms-pages') {
    // Defensive sanitize for legacy unsanitized records
    const plain = item.toObject ? item.toObject() : item
    return {
      ...plain,
      content: sanitizeCmsHtml(plain.content || ''),
      contentAr: plain.contentAr == null ? null : sanitizeCmsHtml(plain.contentAr),
    }
  }
  if (resource === 'certificates' && !admin) {
    return toPublicCertificate(item)
  }
  return item
}

function toPublicCertificate(item) {
  const plain = item.toObject ? item.toObject() : item
  return {
    id: plain._id || plain.id,
    productId: plain.productId,
    variantId: plain.variantId || null,
    certNumber: plain.certNumber,
    authority: plain.authority,
    issuedDate: plain.issuedDate || null,
    metadata: plain.metadata && typeof plain.metadata === 'object' ? plain.metadata : {},
    fileUrl: plain.fileUrl || null,
  }
}

async function setPrimaryImageAtomic(productId, imageId, session) {
  await ProductImage.updateMany(
    { productId, _id: { $ne: imageId } },
    { $set: { isPrimary: false } },
    { session },
  )
  const updated = await ProductImage.updateOne({ _id: imageId, productId }, { $set: { isPrimary: true } }, { session })
  if (!updated.matchedCount) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Image not found for product')
}

function normalizeStoneKey(value) {
  return String(value || '').trim().toLowerCase()
}

async function normalizeStoneWriteRows(stones = [], variantId, session = null) {
  const rows = []
  for (let index = 0; index < stones.length; index += 1) {
    const row = deserialize(stones[index] || {})
    const rateId = row.stoneRateId || null
    const manualRaw = row.manualCharge
    let mode = row.pricingMode
    if (!mode) {
      if (rateId) mode = 'rate'
      else if (manualRaw != null) mode = 'fixed'
      else mode = 'rate'
    }
    mode = mode === 'fixed' ? 'fixed' : 'rate'

    let stoneType
    let grade
    let unit
    let stoneRateId = null
    let manualCharge = null

    if (mode === 'rate') {
      if (!rateId) throw new AppError(422, 'STONE_RATE_REQUIRED', 'stone_rate_id is required when pricing_mode=rate')
      const rateQuery = StoneRate.findById(rateId)
      if (session) rateQuery.session(session)
      const rate = await rateQuery
      if (!rate) throw new AppError(422, 'STONE_RATE_NOT_FOUND', 'Referenced stone rate was not found')
      stoneType = String(rate.stoneType || '').trim()
      grade = rate.grade == null || rate.grade === '' ? null : String(rate.grade).trim()
      unit = rate.unit === 'carat' ? 'carat' : 'piece'
      stoneRateId = rate.id
      if (row.stoneType && normalizeStoneKey(row.stoneType) !== normalizeStoneKey(stoneType)) {
        throw new AppError(422, 'STONE_RATE_MISMATCH', 'stone_type does not match the referenced StoneRate')
      }
      if (row.grade != null && row.grade !== '' && normalizeStoneKey(row.grade) !== normalizeStoneKey(grade || '')) {
        throw new AppError(422, 'STONE_RATE_MISMATCH', 'grade does not match the referenced StoneRate')
      }
      if (row.unit && row.unit !== unit) {
        throw new AppError(422, 'STONE_RATE_MISMATCH', 'unit does not match the referenced StoneRate')
      }
    } else {
      stoneRateId = null
      manualCharge = Number(manualRaw)
      if (!Number.isFinite(manualCharge) || manualCharge < 0) {
        throw new AppError(422, 'INVALID_MANUAL_CHARGE', 'manual_charge must be a non-negative finite number (complete line charge)')
      }
      stoneType = String(row.stoneType || row.label || '').trim()
      if (!stoneType) throw new AppError(422, 'INVALID_STONE', 'Fixed stones require stone_type or label')
      grade = row.grade == null || row.grade === '' ? null : String(row.grade).trim()
      unit = row.unit === 'carat' ? 'carat' : 'piece'
    }

    const stoneCount = row.stoneCount != null ? Number(row.stoneCount) : (unit === 'piece' ? 1 : 1)
    const weight = row.weight != null ? Number(row.weight) : undefined
    if (unit === 'carat') {
      if (!Number.isFinite(weight) || !(weight > 0)) {
        throw new AppError(422, 'INVALID_STONE_WEIGHT', 'Carat-rated stones require weight greater than zero')
      }
    } else if (!Number.isFinite(stoneCount) || !(stoneCount >= 1) || !Number.isInteger(stoneCount)) {
      throw new AppError(422, 'INVALID_STONE_COUNT', 'Piece-rated stones require stone_count of at least 1')
    }

    const sizeMm = row.sizeMm != null && row.sizeMm !== '' ? Number(row.sizeMm) : null
    if (sizeMm != null && (!Number.isFinite(sizeMm) || sizeMm < 0)) {
      throw new AppError(422, 'INVALID_STONE_SIZE', 'size_mm must be a non-negative number')
    }

    rows.push({
      variantId,
      stoneRateId,
      label: row.label != null && String(row.label).trim() ? String(row.label).trim() : null,
      stoneType,
      grade,
      unit,
      pricingMode: mode,
      stoneCount: unit === 'piece' ? stoneCount : Math.max(1, Number.isInteger(stoneCount) ? stoneCount : 1),
      weight: unit === 'carat' ? weight : (Number.isFinite(weight) && weight > 0 ? weight : null),
      shape: row.shape != null && String(row.shape).trim() ? String(row.shape).trim() : null,
      sizeMm,
      settingType: row.settingType != null && String(row.settingType).trim() ? String(row.settingType).trim() : null,
      manualCharge: mode === 'fixed' ? manualCharge : null,
      displayOrder: row.displayOrder != null ? Number(row.displayOrder) : index,
    })
  }
  return rows
}

async function replaceVariantStones(variantId, stones, session) {
  const rows = await normalizeStoneWriteRows(stones, variantId, session)
  await ProductStone.deleteMany({ variantId }, { session })
  if (rows.length) await ProductStone.create(rows, { session })
  return ProductStone.find({ variantId }).session(session).sort({ displayOrder: 1 })
}

async function loadVariantAggregate(variantId, session = null) {
  const query = Variant.findById(variantId)
  if (session) query.session(session)
  const variant = await query
  if (!variant) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Variant not found')
  const stonesQuery = ProductStone.find({ variantId }).sort({ displayOrder: 1 })
  if (session) stonesQuery.session(session)
  const stones = await stonesQuery
  return { ...variant.toObject(), product_stones: stones }
}

/**
 * Create variant + stones + initial stock in one Mongo transaction.
 * Duplicate idempotency keys: identical request → success; different → 409.
 */
export async function createVariantComplete(payload, actorId) {
  const body = deserialize(payload || {})
  const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey).trim() : null

  const dto = assertCatalogWriteNotEmpty(toCatalogWriteDto('variants', body))
  assertVariantWeights(dto)
  dto.stockQty = 0
  dto.reservedQty = 0

  const stones = body.productStones || body.stones || []
  const stockQty = body.stockQty != null ? Number(body.stockQty) : 0
  if (!Number.isInteger(stockQty) || stockQty < 0) {
    throw new AppError(422, 'INVALID_STOCK_QTY', 'stock_qty must be a non-negative integer')
  }
  const stockIdempotencyKey = stockQty > 0
    ? resolveStockIdempotencyKey(body, { required: true })
    : null

  const requestHash = createHash('sha256').update(stableStringify({
    dto: { ...dto, metadata: undefined },
    stones,
    stockQty,
  })).digest('hex')

  if (idempotencyKey) {
    dto.metadata = { ...(dto.metadata || {}), idempotencyKey, createRequestHash: requestHash }
  }

  const session = await mongoose.startSession()
  try {
    try {
      return await session.withTransaction(async () => {
        const product = await Product.findById(dto.productId).session(session)
        if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found')
        const [created] = await Variant.create([dto], { session })
        const productStones = await replaceVariantStones(created.id, stones, session)
        if (stockQty > 0) {
          await applyStockDelta({
            variantId: created.id,
            delta: stockQty,
            reason: 'admin_adjustment',
            note: 'Initial stock while creating variant',
            referenceType: 'variant_create',
            referenceId: created.id,
            idempotencyKey: stockIdempotencyKey,
            actorId,
            session,
          })
        }
        const fresh = await Variant.findById(created.id).session(session)
        return { ...fresh.toObject(), product_stones: productStones }
      })
    } catch (error) {
      if (idempotencyKey && isDuplicateKey(error)) {
        const existing = await Variant.findOne({ 'metadata.idempotencyKey': idempotencyKey })
        if (existing) {
          if (existing.metadata?.createRequestHash && existing.metadata.createRequestHash !== requestHash) {
            throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key was already used for a different variant create')
          }
          return loadVariantAggregate(existing.id)
        }
      }
      throw error
    }
  } finally {
    await session.endSession()
  }
}

/**
 * Update variant fields, replace stones after validation, and set stock via inventory ledger.
 */
export async function updateVariantComplete(variantId, payload, actorId) {
  const body = deserialize(payload || {})
  const existing = await Variant.findById(variantId)
  if (!existing) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Variant not found')

  const dto = toCatalogWriteDto('variants', body, { partial: true })
  if (dto.productId != null && String(dto.productId) !== String(existing.productId)) {
    throw new AppError(422, 'VARIANT_PRODUCT_IMMUTABLE', 'A variant cannot be moved to a different product')
  }
  delete dto.productId

  assertVariantWeights({
    weightGrams: dto.weightGrams ?? existing.weightGrams,
    effectiveWeight: dto.effectiveWeight !== undefined ? dto.effectiveWeight : existing.effectiveWeight,
  })

  const stonesProvided = Object.prototype.hasOwnProperty.call(body, 'productStones')
    || Object.prototype.hasOwnProperty.call(body, 'stones')
  const stones = body.productStones || body.stones || []
  const stockProvided = body.stockQty !== undefined
  const targetStock = stockProvided ? Number(body.stockQty) : null
  const expectedStock = body.expectedStockQty != null ? Number(body.expectedStockQty) : null
  if (stockProvided && expectedStock == null) {
    throw new AppError(422, 'EXPECTED_STOCK_REQUIRED', 'expected_stock_qty is required when stock_qty is provided')
  }
  const aggregateKey = body.idempotencyKey ? String(body.idempotencyKey).trim() : null
  const requestHash = createHash('sha256').update(stableStringify({
    variantId: String(variantId),
    dto,
    stones: stonesProvided ? stones : null,
    stockQty: targetStock,
    expectedStockQty: expectedStock,
  })).digest('hex')

  if (aggregateKey && existing.metadata?.lastUpdateIdempotencyKey === aggregateKey) {
    if (existing.metadata?.lastUpdateRequestHash && existing.metadata.lastUpdateRequestHash !== requestHash) {
      throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key was already used for a different variant update')
    }
    return loadVariantAggregate(variantId)
  }

  const session = await mongoose.startSession()
  try {
    return await session.withTransaction(async () => {
      if (aggregateKey) {
        const prior = await Variant.findOne({
          _id: variantId,
          'metadata.lastUpdateIdempotencyKey': aggregateKey,
        }).session(session)
        if (prior) {
          if (prior.metadata?.lastUpdateRequestHash && prior.metadata.lastUpdateRequestHash !== requestHash) {
            throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key was already used for a different variant update')
          }
          return loadVariantAggregate(variantId, session)
        }
      }

      const filter = { _id: variantId }
      if (expectedStock != null) filter.stockQty = expectedStock
      const current = await Variant.findOne(filter).session(session)
      if (!current) {
        throw new AppError(409, 'VARIANT_VERSION_CONFLICT', 'Variant stock changed; refresh and retry')
      }

      if (Object.keys(dto).length) {
        Object.assign(current, dto)
      }
      if (aggregateKey) {
        current.metadata = {
          ...(current.metadata || {}),
          lastUpdateIdempotencyKey: aggregateKey,
          lastUpdateRequestHash: requestHash,
        }
      }
      if (Object.keys(dto).length || aggregateKey) {
        await current.save({ session })
      }

      let productStones
      if (stonesProvided) {
        productStones = await replaceVariantStones(variantId, stones, session)
      } else {
        productStones = await ProductStone.find({ variantId }).session(session).sort({ displayOrder: 1 })
      }

      if (stockProvided) {
        if (!Number.isInteger(targetStock) || targetStock < 0) {
          throw new AppError(422, 'INVALID_STOCK_QTY', 'stock_qty must be a non-negative integer')
        }
        const delta = targetStock - current.stockQty
        if (delta !== 0) {
          const stockIdempotencyKey = resolveStockIdempotencyKey(body, { required: true })
          await applyStockDelta({
            variantId,
            delta,
            reason: 'admin_adjustment',
            note: 'Stock set from variant editor',
            referenceType: 'variant_update',
            referenceId: variantId,
            idempotencyKey: stockIdempotencyKey,
            actorId,
            session,
            operationType: 'variant_update_stock',
          })
        }
      }

      const fresh = await Variant.findById(variantId).session(session)
      return { ...fresh.toObject(), product_stones: productStones }
    })
  } finally {
    await session.endSession()
  }
}

export async function setPrimaryImage(imageId) {
  const session = await mongoose.startSession()
  try {
    return await session.withTransaction(async () => {
      const image = await ProductImage.findById(imageId).session(session)
      if (!image) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Image not found')
      await setPrimaryImageAtomic(image.productId, image.id, session)
      return ProductImage.findById(imageId).session(session)
    })
  } finally {
    await session.endSession()
  }
}

async function assertProductAndVariant(dto) {
  if (!dto.productId) return
  const product = await Product.findById(dto.productId).select('_id')
  if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found')
  if (dto.variantId) {
    const variant = await Variant.findById(dto.variantId).select('_id productId')
    if (!variant) throw new AppError(404, 'VARIANT_NOT_FOUND', 'Variant not found')
    if (String(variant.productId) !== String(dto.productId)) {
      throw new AppError(422, 'VARIANT_PRODUCT_MISMATCH', 'variant_id does not belong to product_id')
    }
  }
}

export async function create(resource, payload) {
  if (resource === 'variants' || resource === 'stones') {
    throw new AppError(422, 'USE_VARIANT_AGGREGATE', 'Use POST /admin/catalog/variants/complete for variant and stone mutations')
  }
  const dto = assertCatalogWriteNotEmpty(toCatalogWriteDto(resource, payload))

  if (resource === 'certificates' || resource === 'images') {
    await assertProductAndVariant(dto)
  }

  if (resource === 'cms-pages') {
    try {
      return await CmsPage.create(dto)
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new AppError(409, 'SLUG_CONFLICT', 'A CMS page with this slug already exists')
      }
      throw error
    }
  }

  if (resource === 'images' && dto.isPrimary) {
    const session = await mongoose.startSession()
    try {
      return await session.withTransaction(async () => {
        const [created] = await ProductImage.create([dto], { session })
        await setPrimaryImageAtomic(created.productId, created.id, session)
        return created
      })
    } finally {
      await session.endSession()
    }
  }

  if (resource === 'products') {
    const session = await mongoose.startSession()
    try {
      return await session.withTransaction(async () => {
        const [created] = await getResourceModel(resource).create([dto], { session })
        return created
      })
    } finally {
      await session.endSession()
    }
  }

  return getResourceModel(resource).create(dto)
}

export async function update(resource, id, payload) {
  if (resource === 'variants' || resource === 'stones') {
    throw new AppError(422, 'USE_VARIANT_AGGREGATE', 'Use PATCH /admin/catalog/variants/:id/complete for variant and stone mutations')
  }
  const dto = assertCatalogWriteNotEmpty(toCatalogWriteDto(resource, payload, { partial: true }))
  if (resource === 'variants') {
    const existing = await Variant.findById(id)
    if (!existing) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Resource not found')
    assertVariantWeights({
      weightGrams: dto.weightGrams ?? existing.weightGrams,
      effectiveWeight: dto.effectiveWeight !== undefined ? dto.effectiveWeight : existing.effectiveWeight,
    })
  }

  if (resource === 'certificates' || resource === 'images') {
    const existing = await getResourceModel(resource).findById(id)
    if (!existing) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Resource not found')
    const merged = {
      productId: dto.productId ?? existing.productId,
      variantId: dto.variantId !== undefined ? dto.variantId : existing.variantId,
    }
    await assertProductAndVariant(merged)
  }

  if (resource === 'cms-pages') {
    try {
      const item = await CmsPage.findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
      if (!item) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Resource not found')
      return {
        ...item.toObject(),
        content: sanitizeCmsHtml(item.content || ''),
        contentAr: item.contentAr == null ? null : sanitizeCmsHtml(item.contentAr),
      }
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new AppError(409, 'SLUG_CONFLICT', 'A CMS page with this slug already exists')
      }
      throw error
    }
  }

  if (resource === 'images' && dto.isPrimary === true) {
    const session = await mongoose.startSession()
    try {
      return await session.withTransaction(async () => {
        const image = await ProductImage.findById(id).session(session)
        if (!image) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Resource not found')
        Object.assign(image, dto)
        await image.save({ session })
        await setPrimaryImageAtomic(image.productId, image.id, session)
        return image
      })
    } finally {
      await session.endSession()
    }
  }

  const item = await getResourceModel(resource).findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
  if (!item) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Resource not found')
  return item
}

export async function remove(resource, id) {
  const Model = getResourceModel(resource)
  const item = await Model.findById(id)
  if (!item) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Resource not found')

  if (resource === 'products') {
    const { Order } = await import('../models/commerce.models.js')
    const referenced = await Order.exists({ 'items.productId': id })
    if (referenced) {
      item.status = 'archived'
      await item.save()
      return item
    }
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        const variantIds = await Variant.find({ productId: id }).session(session).distinct('_id')
        await ProductStone.deleteMany({ variantId: { $in: variantIds } }, { session })
        await Variant.deleteMany({ productId: id }, { session })
        await ProductImage.deleteMany({ productId: id }, { session })
        await Certificate.deleteMany({ productId: id }, { session })
        await Product.deleteOne({ _id: id }, { session })
      })
    } finally {
      await session.endSession()
    }
    return
  }

  if (resource === 'variants') {
    const { Order } = await import('../models/commerce.models.js')
    const referenced = await Order.exists({ 'items.variantId': id })
    if (referenced) {
      item.isActive = false
      await item.save()
      return item
    }
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        await ProductStone.deleteMany({ variantId: id }, { session })
        await Variant.deleteOne({ _id: id }, { session })
      })
    } finally {
      await session.endSession()
    }
    return
  }

  if (resource === 'categories' || resource === 'brands') {
    item.isActive = false
    await item.save()
    return item
  }

  if (resource === 'images') {
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        const wasPrimary = item.isPrimary
        const productId = item.productId
        await ProductImage.deleteOne({ _id: item._id }, { session })
        if (wasPrimary) {
          // Deterministic: promote lowest displayOrder, then oldest createdAt.
          const next = await ProductImage.findOne({ productId })
            .sort({ displayOrder: 1, createdAt: 1 })
            .session(session)
          if (next) {
            await setPrimaryImageAtomic(productId, next.id, session)
          }
        }
      })
    } finally {
      await session.endSession()
    }
    return
  }

  await item.deleteOne()
}

export async function publicBootstrap() {
  const [settings, tax, goldRates, stoneRates] = await Promise.all([
    StoreSetting.findOneAndUpdate({ singleton: 'default' }, { $setOnInsert: { storeName: 'Goldex' } }, { upsert: true, new: true }),
    TaxSetting.findOneAndUpdate({ singleton: 'default' }, { $setOnInsert: {} }, { upsert: true, new: true }),
    GoldRate.find({ isCurrent: true }),
    StoneRate.find({ isCurrent: true }),
  ])
  return { settings, tax, goldRates, stoneRates }
}

export async function updateSettings(kind, payload) {
  const Model = kind === 'tax' ? TaxSetting : StoreSetting
  const allowed = kind === 'tax'
    ? ['taxName', 'taxPercent', 'taxMode', 'taxRegistrationNumber', 'applyOn', 'isActive']
    : [
      'storeName', 'legalName', 'logoUrl', 'currencyCode', 'currencySymbol', 'countryCode',
      'supportEmail', 'supportPhone', 'whatsappNumber', 'address', 'socialLinks',
      'shippingFee', 'freeShippingThreshold', 'returnWindowDays', 'goldSchemeEnabled',
      'codEnabled', 'onlinePaymentEnabled', 'bankTransferEnabled', 'codMinOrderAmount',
      'codMaxOrderAmount', 'minimumOrderAmount', 'paymentTimeoutMinutes',
    ]
  const data = deserialize(payload || {})
  const dto = Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)))
  return Model.findOneAndUpdate({ singleton: 'default' }, { $set: dto }, { upsert: true, new: true, runValidators: true })
}
