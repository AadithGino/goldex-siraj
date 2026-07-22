#!/usr/bin/env node
/**
 * Cleanup expired unattached return-proof uploads.
 * Usage: node scripts/cleanup-return-proofs.js [--dry-run]
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { cleanupExpiredReturnProofs } from '../src/services/upload.service.js'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  await connectDatabase()
  const result = await cleanupExpiredReturnProofs({ dryRun })
  console.log(JSON.stringify({ ok: true, ...result }, null, 2))
  await disconnectDatabase()
}

main().catch(async (error) => {
  console.error(error)
  try { await disconnectDatabase() } catch { /* ignore */ }
  process.exit(1)
})
