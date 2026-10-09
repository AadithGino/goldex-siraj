#!/usr/bin/env node
/**
 * One-off: stop reconciliation retrieve loops for ancient pending Tabby orders.
 * Marks tabbyPaymentStatus=EXPIRED when payment is still pending after 7 days.
 *
 *   node backend/scripts/tabby-mark-stale-pending.js
 *   node backend/scripts/tabby-mark-stale-pending.js --apply
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { Order } from '../src/models/commerce.models.js'

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env'), quiet: true })

const apply = process.argv.includes('--apply')
const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  const filter = {
    paymentMethod: 'online',
    paymentProvider: 'tabby',
    paymentStatus: 'pending',
    tabbyPaymentId: { $ne: null },
    tabbyPaymentStatus: { $nin: ['REJECTED', 'EXPIRED', 'CLOSED'] },
    $or: [{ placedAt: { $lt: cutoff } }, { createdAt: { $lt: cutoff } }],
  }
  const count = await Order.countDocuments(filter)
  console.log(`Stale pending Tabby orders (older than 7d): ${count}`)
  if (apply && count > 0) {
    const res = await Order.updateMany(filter, {
      $set: { tabbyPaymentStatus: 'EXPIRED', tabbyFallbackRetrieveDone: true },
    })
    console.log('Updated', res.modifiedCount)
  } else if (!apply) {
    console.log('Dry run — pass --apply to mark EXPIRED')
  }
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
