/**
 * Idempotent brand logo backfill (dry-run first).
 *
 * Copies legacy `logoUrl` into empty responsive logo slots so storefront
 * components that prefer logo_*_url still show a logo.
 *
 * Does NOT overwrite existing responsive URLs or clear `logoUrl`.
 *
 * Usage:
 *   node scripts/backfill-brand-responsive-logos.js --dry-run
 *   node scripts/backfill-brand-responsive-logos.js --apply
 *
 * Do not run against production from Phase 22 automation.
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { Brand } from '../src/models/catalog.models.js'

const dryRun = !process.argv.includes('--apply')

async function main() {
  await connectDatabase()
  const brands = await Brand.find({
    logoUrl: { $type: 'string', $ne: '' },
    $or: [
      { logoDesktopUrl: { $in: [null, ''] } },
      { logoDesktopUrl: { $exists: false } },
      { logoTabletUrl: { $in: [null, ''] } },
      { logoTabletUrl: { $exists: false } },
      { logoMobileUrl: { $in: [null, ''] } },
      { logoMobileUrl: { $exists: false } },
    ],
  }).lean()

  let wouldUpdate = 0
  let updated = 0

  console.log(`Brand responsive logo backfill (${dryRun ? 'dry-run' : 'apply'})`)
  console.log(`Candidates: ${brands.length}`)

  for (const brand of brands) {
    const set = {}
    if (!brand.logoDesktopUrl) set.logoDesktopUrl = brand.logoUrl
    if (!brand.logoTabletUrl) set.logoTabletUrl = brand.logoUrl
    if (!brand.logoMobileUrl) set.logoMobileUrl = brand.logoUrl
    if (!Object.keys(set).length) continue

    wouldUpdate += 1
    console.log(`  ${brand._id} ${brand.slug}: set ${Object.keys(set).join(', ')} from logoUrl`)

    if (!dryRun) {
      await Brand.updateOne({ _id: brand._id }, { $set: set })
      updated += 1
    }
  }

  console.log(JSON.stringify({
    ok: true,
    mode: dryRun ? 'dry-run' : 'apply',
    candidates: brands.length,
    wouldUpdate,
    updated,
    note: 'logoUrl is never cleared. Existing responsive URLs are never overwritten.',
  }))

  await disconnectDatabase()
}

main().catch(async (error) => {
  console.error(error)
  try { await disconnectDatabase() } catch { /* ignore */ }
  process.exit(1)
})
