/**
 * Dry-run: report duplicate active scheme enrollments (same customerId + schemeId).
 * Does NOT delete or merge. Do not run apply against production from this phase.
 *
 * Usage:
 *   node scripts/report-duplicate-scheme-enrollments.js
 */
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'

async function main() {
  await connectDatabase()
  const rows = await mongoose.connection.collection('schemeenrollments').aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: { customerId: '$customerId', schemeId: '$schemeId' },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray()

  console.log(JSON.stringify({
    duplicate_active_groups: rows.length,
    groups: rows.map((row) => ({
      customer_id: String(row._id.customerId),
      scheme_id: String(row._id.schemeId),
      count: row.count,
      enrollment_ids: row.ids.map(String),
    })),
  }, null, 2))

  await disconnectDatabase()
  process.exit(rows.length ? 2 : 0)
}

main().catch(async (error) => {
  console.error(error)
  try { await disconnectDatabase() } catch { /* ignore */ }
  process.exit(1)
})
