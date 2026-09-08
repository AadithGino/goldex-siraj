import mongoose from 'mongoose'
import { Product, ProductImage, Variant } from '../models/catalog.models.js'
import { Address, CartItem, WishlistItem } from '../models/commerce.models.js'
import { AppError } from '../utils/AppError.js'
import { customizationKey, normalizeCustomization } from '../utils/customization.js'
import { deserialize } from '../utils/serialize.js'
import { assertAddressPayload, toAddressDto } from './address.dto.js'
import { getPriceBreakup } from './pricing.service.js'

export async function listCart(customerId) {
  const rows = await CartItem.find({ customerId }).sort({ addedAt: -1 }).lean()
  if (!rows.length) return []

  const variantIds = [...new Set(rows.map((row) => String(row.variantId)).filter(Boolean))]
  const variants = await Variant.find({ _id: { $in: variantIds } }).lean()
  const variantById = new Map(variants.map((variant) => [String(variant._id), variant]))
  const productIds = [...new Set(variants.map((variant) => String(variant.productId)).filter(Boolean))]

  const [products, images, productVariants] = await Promise.all([
    productIds.length ? Product.find({ _id: { $in: productIds } }).lean() : Promise.resolve([]),
    productIds.length ? ProductImage.find({ productId: { $in: productIds } }).sort({ displayOrder: 1 }).lean() : Promise.resolve([]),
    productIds.length ? Variant.find({ productId: { $in: productIds }, isActive: true }).sort({ weightGrams: 1 }).lean() : Promise.resolve([]),
  ])
  const productById = new Map(products.map((product) => [String(product._id), product]))
  const imagesByProduct = new Map()
  for (const image of images) {
    const key = String(image.productId)
    if (!imagesByProduct.has(key)) imagesByProduct.set(key, [])
    imagesByProduct.get(key).push(image)
  }
  const variantsByProduct = new Map()
  for (const variant of productVariants) {
    const key = String(variant.productId)
    if (!variantsByProduct.has(key)) variantsByProduct.set(key, [])
    variantsByProduct.get(key).push(variant)
  }

  return rows.map((row) => {
    const variant = variantById.get(String(row.variantId))
    if (!variant) return { ...row, product_variants: null }
    const productId = String(variant.productId)
    const product = productById.get(productId)
    const imageRows = imagesByProduct.get(productId) || []
    const mappedImages = imageRows.map((image) => ({ ...image, url: image.imageUrl, alt: image.altText }))
    return {
      ...row,
      product_variants: {
        ...variant,
        products: product
          ? {
              ...product,
              product_images: mappedImages,
              primary_image: imageRows.find((image) => image.isPrimary)?.imageUrl || imageRows[0]?.imageUrl || null,
              product_variants: variantsByProduct.get(productId) || [],
            }
          : null,
      },
    }
  })
}

function readCustomizationFromPayload(payload) {
  const present = Object.prototype.hasOwnProperty.call(payload, 'customizationRequest')
  return {
    present,
    normalized: normalizeCustomization(payload.customizationRequest, { present }),
  }
}

export async function addCartItem(customerId, input) {
  const payload = deserialize(input)
  const variant = await Variant.findOne({ _id: payload.variantId, isActive: true })
  if (!variant) throw new AppError(404, 'VARIANT_NOT_FOUND', 'Product variant not found')

  // Omitted customization → null (no engraving). Explicit null/empty → null.
  const { present, normalized } = readCustomizationFromPayload(payload)
  const customization = present ? normalized : null
  const key = customizationKey(customization)

  const current = await CartItem.findOne({
    customerId,
    variantId: variant.id,
    customizationKey: key,
  })
  const qty = Number(current?.qty || 0) + Number(payload.qty || 1)
  if (variant.stockQty - variant.reservedQty < qty) {
    throw new AppError(409, 'INSUFFICIENT_STOCK', `Only ${Math.max(0, variant.stockQty - variant.reservedQty)} left in stock`)
  }
  const price = await getPriceBreakup(variant.id)

  const $set = {
    qty,
    priceSnapshot: price.total,
    goldRateSnapshot: price.gold_rate,
    customizationKey: key,
  }
  // Explicit presence (including null) always wins; omitted on first create stores null.
  if (present || !current) {
    $set.customizationRequest = customization
  }

  return CartItem.findOneAndUpdate(
    { customerId, variantId: variant.id, customizationKey: key },
    { $set, $setOnInsert: { customerId, variantId: variant.id } },
    { upsert: true, new: true, runValidators: true },
  )
}

export async function updateCartItem(customerId, itemId, input) {
  const payload = deserialize(input)
  const item = await CartItem.findOne({ _id: itemId, customerId })
  if (!item) throw new AppError(404, 'CART_ITEM_NOT_FOUND', 'Cart item not found')
  if (payload.qty != null && payload.qty < 1) {
    await item.deleteOne()
    return null
  }

  const variantId = payload.variantId || item.variantId
  const variant = await Variant.findOne({ _id: variantId, isActive: true })
  const qty = payload.qty ?? item.qty
  if (!variant || variant.stockQty - variant.reservedQty < qty) {
    throw new AppError(409, 'INSUFFICIENT_STOCK', 'Requested quantity is unavailable')
  }

  let nextCustomization = item.customizationRequest ?? null
  let nextKey = item.customizationKey ?? customizationKey(nextCustomization)
  if (Object.prototype.hasOwnProperty.call(payload, 'customizationRequest')) {
    nextCustomization = normalizeCustomization(payload.customizationRequest, { present: true })
    nextKey = customizationKey(nextCustomization)
  }

  // Variant and/or customization identity change may collide with an existing line.
  const identityChanged = String(variantId) !== String(item.variantId) || nextKey !== (item.customizationKey ?? '')
  if (identityChanged) {
    const existing = await CartItem.findOne({
      customerId,
      variantId,
      customizationKey: nextKey,
      _id: { $ne: item.id },
    })
    if (existing) {
      const mergedQty = existing.qty + qty
      if (variant.stockQty - variant.reservedQty < mergedQty) {
        throw new AppError(409, 'INSUFFICIENT_STOCK', 'Requested quantity is unavailable')
      }
      existing.qty = mergedQty
      const price = await getPriceBreakup(variantId)
      existing.priceSnapshot = price.total
      existing.goldRateSnapshot = price.gold_rate
      existing.customizationRequest = nextCustomization
      existing.customizationKey = nextKey
      await existing.save()
      await item.deleteOne()
      return existing
    }
  }

  const price = await getPriceBreakup(variantId)
  item.variantId = variantId
  item.qty = qty
  item.priceSnapshot = price.total
  item.goldRateSnapshot = price.gold_rate
  if (Object.prototype.hasOwnProperty.call(payload, 'customizationRequest')) {
    item.customizationRequest = nextCustomization
    item.customizationKey = nextKey
  }
  return item.save()
}

export async function removeCartItem(customerId, itemId) {
  const result = await CartItem.deleteOne({ _id: itemId, customerId })
  if (!result.deletedCount) throw new AppError(404, 'CART_ITEM_NOT_FOUND', 'Cart item not found')
}
export const clearCart = (customerId) => CartItem.deleteMany({ customerId })

export async function listWishlist(customerId) {
  const rows = await WishlistItem.find({ customerId }).sort({ createdAt: -1 }).lean()
  if (!rows.length) return []

  const productIds = [...new Set(rows.map((row) => String(row.productId)).filter(Boolean))]
  const [products, images, variants] = await Promise.all([
    productIds.length ? Product.find({ _id: { $in: productIds } }).lean() : Promise.resolve([]),
    productIds.length ? ProductImage.find({ productId: { $in: productIds } }).sort({ displayOrder: 1 }).lean() : Promise.resolve([]),
    productIds.length ? Variant.find({ productId: { $in: productIds }, isActive: true }).sort({ weightGrams: 1 }).lean() : Promise.resolve([]),
  ])
  const productById = new Map(products.map((product) => [String(product._id), product]))
  const imagesByProduct = new Map()
  for (const image of images) {
    const key = String(image.productId)
    if (!imagesByProduct.has(key)) imagesByProduct.set(key, [])
    imagesByProduct.get(key).push(image)
  }
  const variantsByProduct = new Map()
  for (const variant of variants) {
    const key = String(variant.productId)
    if (!variantsByProduct.has(key)) variantsByProduct.set(key, [])
    variantsByProduct.get(key).push(variant)
  }

  return rows.map((row) => {
    const productId = String(row.productId)
    const product = productById.get(productId)
    if (!product) return { ...row, products: null }
    const imageRows = imagesByProduct.get(productId) || []
    return {
      ...row,
      products: {
        ...product,
        product_images: imageRows.map((image) => ({ ...image, url: image.imageUrl, alt: image.altText })),
        primary_image: imageRows.find((image) => image.isPrimary)?.imageUrl || imageRows[0]?.imageUrl || null,
        product_variants: variantsByProduct.get(productId) || [],
      },
    }
  })
}
export const addWishlist = (customerId, productId) => WishlistItem.findOneAndUpdate({ customerId, productId }, { $setOnInsert: { customerId, productId } }, { upsert: true, new: true })
export const removeWishlist = (customerId, productId) => WishlistItem.deleteOne({ customerId, productId })

export const listAddresses = (customerId) => Address.find({ customerId }).sort({ isDefault: -1, createdAt: -1 })
export async function saveAddress(customerId, input, id) {
  const raw = toAddressDto(input)
  if (!id && !raw.country) raw.country = 'United Arab Emirates'
  const dto = assertAddressPayload(raw, { partial: Boolean(id) })
  if (id && Object.keys(dto).length === 0) {
    throw new AppError(422, 'ADDRESS_VALIDATION', 'No address fields to update')
  }

  const session = await mongoose.startSession()
  try {
    return await session.withTransaction(async () => {
      if (dto.isDefault) {
        await Address.updateMany({ customerId }, { $set: { isDefault: false } }, { session })
      }
      if (id) {
        const updated = await Address.findOneAndUpdate(
          { _id: id, customerId },
          { $set: dto },
          { new: true, runValidators: true, session },
        )
        if (!updated) throw new AppError(404, 'ADDRESS_NOT_FOUND', 'Address not found')
        return updated
      }
      const [created] = await Address.create([{ ...dto, customerId }], { session })
      return created
    })
  } finally {
    await session.endSession()
  }
}
export async function removeAddress(customerId, id) {
  const result = await Address.deleteOne({ _id: id, customerId })
  if (!result.deletedCount) throw new AppError(404, 'ADDRESS_NOT_FOUND', 'Address not found')
}
