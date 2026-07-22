import mongoose from 'mongoose'
import { ProductImage } from '../models/catalog.models.js'

/**
 * Deterministic primary winner:
 * 1. Lowest displayOrder
 * 2. Oldest createdAt
 * 3. Lowest _id
 */
export function pickPrimaryWinner(images = []) {
  if (!images.length) return null
  return [...images].sort((a, b) => {
    const ao = Number(a.displayOrder ?? 0)
    const bo = Number(b.displayOrder ?? 0)
    if (ao !== bo) return ao - bo
    const at = new Date(a.createdAt || 0).getTime()
    const bt = new Date(b.createdAt || 0).getTime()
    if (at !== bt) return at - bt
    return String(a._id).localeCompare(String(b._id))
  })[0]
}

/**
 * Analyze products with duplicate primaries or missing primary.
 * @returns {{ products: Array, totals: object }}
 */
export async function analyzePrimaryImageIssues({ ProductImageModel = ProductImage } = {}) {
  const all = await ProductImageModel.find({}).lean()
  const byProduct = new Map()
  for (const img of all) {
    const key = String(img.productId)
    if (!byProduct.has(key)) byProduct.set(key, [])
    byProduct.get(key).push(img)
  }

  const products = []
  let duplicatePrimaryCount = 0
  let missingPrimaryCount = 0
  let alreadyCorrect = 0

  for (const [productId, images] of byProduct.entries()) {
    const primaries = images.filter((row) => row.isPrimary === true)
    const winner = pickPrimaryWinner(images)
    if (!winner) continue

    // Only reconcile duplicates and missing primary. A single existing primary is left alone.
    if (primaries.length === 1) {
      alreadyCorrect += 1
      continue
    }
    if (primaries.length === 0 && images.length === 0) continue

    let issue = null
    if (primaries.length > 1) {
      issue = 'duplicate_primary'
      duplicatePrimaryCount += 1
    } else if (primaries.length === 0) {
      issue = 'missing_primary'
      missingPrimaryCount += 1
    } else {
      alreadyCorrect += 1
      continue
    }

    const demoteIds = images
      .filter((row) => String(row._id) !== String(winner._id) && row.isPrimary)
      .map((row) => String(row._id))

    products.push({
      product_id: productId,
      issue,
      image_count: images.length,
      current_primary_ids: primaries.map((row) => String(row._id)),
      winner_image_id: String(winner._id),
      winner_display_order: winner.displayOrder ?? 0,
      demote_image_ids: demoteIds,
      promote: !winner.isPrimary,
      proposed_updates: {
        set_primary: String(winner._id),
        clear_primary: images
          .filter((row) => String(row._id) !== String(winner._id))
          .map((row) => String(row._id)),
      },
    })
  }

  return {
    products,
    totals: {
      products_scanned: byProduct.size,
      images_scanned: all.length,
      already_correct: alreadyCorrect,
      duplicate_primary_products: duplicatePrimaryCount,
      missing_primary_products: missingPrimaryCount,
      products_needing_update: products.length,
    },
  }
}

/**
 * Apply reconciliation for reported products. Idempotent.
 */
export async function applyPrimaryImageReconciliation(
  products,
  { ProductImageModel = ProductImage, mongooseConn = mongoose } = {},
) {
  let updated = 0
  const session = await mongooseConn.startSession()
  try {
    await session.withTransaction(async () => {
      for (const row of products) {
        const winnerId = row.winner_image_id
        const productId = row.product_id
        await ProductImageModel.updateMany(
          { productId, _id: { $ne: winnerId } },
          { $set: { isPrimary: false } },
          { session },
        )
        const res = await ProductImageModel.updateOne(
          { _id: winnerId, productId },
          { $set: { isPrimary: true } },
          { session },
        )
        if (res.matchedCount) updated += 1
      }
    })
  } finally {
    await session.endSession()
  }
  return { products_updated: updated }
}
