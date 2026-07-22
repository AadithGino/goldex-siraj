/**
 * One-off maintenance: set effectiveAt = createdAt where effectiveAt is missing.
 * Does not run on application startup.
 *
 * Usage: node scripts/repair-rate-effective-at.js
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { GoldRate, StoneRate } from '../src/models/rate.models.js'

async function repair(Model, label) {
  const broken = await Model.find({
    $or: [{ effectiveAt: null }, { effectiveAt: { $exists: false } }],
  }).select('_id createdAt effectiveAt')

  let updated = 0
  for (const doc of broken) {
    if (!doc.createdAt) continue
    doc.effectiveAt = doc.createdAt
    await doc.save()
    updated += 1
  }
  console.log(`${label}: repaired ${updated} of ${broken.length} candidate records`)
}

async function main() {
  await connectDatabase()
  await repair(GoldRate, 'GoldRate')
  await repair(StoneRate, 'StoneRate')
}

main()
  .then(() => disconnectDatabase())
  .catch(async (error) => {
    console.error(error)
    await disconnectDatabase().catch(() => null)
    process.exit(1)
  })
