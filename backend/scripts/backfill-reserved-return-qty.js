/**
 * Backfill Order.items[].reservedReturnQty to 0 where missing.
 *
 * Does NOT overwrite existing numeric values.
 * Exits nonzero when reservedReturnQty + returnedQty > qty (invalid invariant).
 *
 * Usage:
 *   node scripts/backfill-reserved-return-qty.js                    # dry-run (default)
 *   node scripts/backfill-reserved-return-qty.js --apply
 *   node scripts/backfill-reserved-return-qty.js --batch-size=100
 *   node scripts/backfill-reserved-return-qty.js --after=<orderId>
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { Order } from '../src/models/commerce.models.js'

function parseArgs(argv = process.argv.slice(2)) {
  const apply = argv.includes('--apply')
  let batchSize = 100
  let after = null
  for (const arg of argv) {
    if (arg.startsWith('--batch-size=')) batchSize = Math.max(1, Number(arg.slice('--batch-size='.length)) || 100)
    if (arg.startsWith('--after=')) after = arg.slice('--after='.length) || null
  }
  return { apply, dryRun: !apply, batchSize, after }
}

export async function runBackfillReservedReturnQty(options = {}) {
  const { apply = false, dryRun = !apply, batchSize = 100, after = null } = options
  const totals = {
    mode: dryRun ? 'dry-run' : 'apply',
    batchSize,
    after,
    scannedOrders: 0,
    scannedItems: 0,
    missingReserved: 0,
    wouldSet: 0,
    updated: 0,
    invalid: 0,
    lastOrderId: after,
    invalidSamples: [],
  }

  // Preflight: scan for invalid invariants before any writes.
  let cursorFilter = {}
  if (after) cursorFilter = { _id: { $gt: after } }

  const preflightCursor = Order.find(cursorFilter).select('_id orderNumber items').sort({ _id: 1 }).cursor()
  for await (const order of preflightCursor) {
    for (let index = 0; index < (order.items || []).length; index += 1) {
      const item = order.items[index]
      const qty = Number(item.qty || 0)
      const returnedQty = Number(item.returnedQty || 0)
      const hasReserved = item.reservedReturnQty != null && Number.isFinite(Number(item.reservedReturnQty))
      const reservedReturnQty = hasReserved ? Number(item.reservedReturnQty) : 0
      if (reservedReturnQty + returnedQty > qty) {
        totals.invalid += 1
        if (totals.invalidSamples.length < 20) {
          totals.invalidSamples.push({
            orderId: String(order._id),
            orderNumber: order.orderNumber,
            itemIndex: index,
            qty,
            returnedQty,
            reservedReturnQty,
          })
        }
      }
    }
  }

  if (totals.invalid > 0) {
    totals.exitCode = 2
    return totals
  }

  // Apply / dry-run in batches (resumable via --after / totals.lastOrderId).
  let lastId = after
  for (;;) {
    const filter = lastId ? { _id: { $gt: lastId } } : {}
    const batch = await Order.find(filter).select('_id orderNumber items').sort({ _id: 1 }).limit(batchSize).lean()
    if (!batch.length) break

    for (const order of batch) {
      totals.scannedOrders += 1
      totals.lastOrderId = String(order._id)
      const setPaths = {}

      for (let index = 0; index < (order.items || []).length; index += 1) {
        const item = order.items[index]
        totals.scannedItems += 1
        const hasReserved = item.reservedReturnQty != null && Number.isFinite(Number(item.reservedReturnQty))
        if (!hasReserved) {
          totals.missingReserved += 1
          totals.wouldSet += 1
          setPaths[`items.${index}.reservedReturnQty`] = 0
        }
      }

      if (Object.keys(setPaths).length && !dryRun) {
        await Order.updateOne({ _id: order._id }, { $set: setPaths })
        totals.updated += 1
      }
    }

    lastId = batch[batch.length - 1]._id
    if (batch.length < batchSize) break
  }

  totals.exitCode = 0
  return totals
}

async function main() {
  const args = parseArgs()
  let exitCode = 0
  try {
    await connectDatabase()
    const totals = await runBackfillReservedReturnQty(args)
    console.log(JSON.stringify(totals, null, 2))
    exitCode = totals.exitCode || 0
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      error: error.message,
    }))
    exitCode = 1
  } finally {
    try {
      await disconnectDatabase()
    } catch {
      // ignore disconnect errors
    }
  }
  process.exit(exitCode)
}

const isDirect = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isDirect) {
  main()
}
