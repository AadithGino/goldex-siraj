/**
 * Derive WalletAccount.balance from the WalletTransaction ledger.
 *
 * Rules:
 * - Idempotent dry-run / apply
 * - Does NOT clamp negative ledger balances to zero
 * - Negative ledger balances or nonzero orphan accounts block apply (exit 2)
 * - Prefer maintenance window: pause wallet writes before apply
 *
 * Usage:
 *   node scripts/backfill-wallet-accounts.js --dry-run
 *   node scripts/backfill-wallet-accounts.js
 *
 * Cutover:
 * 1. Enable maintenance / stop checkout & refund traffic
 * 2. --dry-run and review machine-readable TOTALS JSON
 * 3. apply (refused if negatives or nonzero orphans)
 * 4. Re-run dry-run; confirm zero discrepancies
 * 5. Resume traffic
 */
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { WalletAccount, WalletTransaction } from '../src/models/commerce.models.js'
import { roundMoney } from '../src/utils/money.js'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  await connectDatabase()
  const sums = await WalletTransaction.aggregate([
    { $group: { _id: '$customerId', ledgerBalance: { $sum: '$amount' }, txCount: { $sum: 1 } } },
  ])

  let discrepancies = 0
  let negativeLedgers = 0
  let nonzeroOrphans = 0
  let updated = 0
  let created = 0
  let beforeTotal = 0
  let afterTotal = 0
  let ledgerTotal = 0

  const existingAccounts = await WalletAccount.find().lean()
  beforeTotal = roundMoney(existingAccounts.reduce((sum, row) => sum + Number(row.balance || 0), 0))

  console.log(`Backfill WalletAccount (${dryRun ? 'dry-run' : 'apply'})…`)
  console.log(`Customers with ledger activity: ${sums.length}`)
  console.log(`Before WalletAccount sum: ${beforeTotal}`)

  const applyBlocked = () => negativeLedgers > 0 || nonzeroOrphans > 0

  // First pass: detect negatives before any writes
  for (const row of sums) {
    const ledgerBalance = roundMoney(Number(row.ledgerBalance || 0))
    if (ledgerBalance < 0) {
      negativeLedgers += 1
      console.error(`  NEGATIVE ledger customer ${row._id}: ${ledgerBalance} (${row.txCount} txs)`)
    }
  }

  const orphanAccounts = await WalletAccount.find({
    customerId: { $nin: sums.map((row) => row._id).filter(Boolean) },
  }).lean()
  for (const account of orphanAccounts) {
    const bal = roundMoney(Number(account.balance || 0))
    if (bal === 0) continue
    nonzeroOrphans += 1
    discrepancies += 1
    console.log(`  orphan account ${account.customerId}: balance=${bal} (no ledger rows)`)
  }

  if (!dryRun && applyBlocked()) {
    console.error(JSON.stringify({
      ok: false,
      mode: 'apply',
      blocked: true,
      reason: negativeLedgers ? 'negative_ledger' : 'nonzero_orphan_accounts',
      totals: {
        beforeTotal,
        ledgerTotal: null,
        afterTotal: null,
        discrepancies,
        negativeLedgers,
        nonzeroOrphans,
        created: 0,
        updated: 0,
      },
    }))
    console.error('Refusing apply: resolve negative ledgers and nonzero orphan accounts first.')
    process.exitCode = 2
    await mongoose.disconnect().catch(() => null)
    return
  }

  for (const row of sums) {
    const customerId = row._id
    const ledgerBalance = roundMoney(Number(row.ledgerBalance || 0))
    ledgerTotal = roundMoney(ledgerTotal + ledgerBalance)

    const account = await WalletAccount.findOne({ customerId }).lean()
    const current = account ? roundMoney(account.balance || 0) : null

    if (current === ledgerBalance) {
      afterTotal = roundMoney(afterTotal + ledgerBalance)
      continue
    }
    discrepancies += 1
    console.log(`  customer ${customerId}: account=${current ?? 'missing'} ledger=${ledgerBalance}`)

    if (!dryRun) {
      if (!account) {
        await WalletAccount.create({ customerId, balance: ledgerBalance })
        created += 1
      } else {
        await WalletAccount.updateOne({ customerId }, { $set: { balance: ledgerBalance } })
        updated += 1
      }
      afterTotal = roundMoney(afterTotal + ledgerBalance)
    } else {
      afterTotal = roundMoney(afterTotal + ledgerBalance)
    }
  }

  for (const account of orphanAccounts) {
    afterTotal = roundMoney(afterTotal + Number(account.balance || 0))
  }

  const totals = {
    beforeTotal,
    ledgerTotal,
    afterTotal,
    discrepancies,
    negativeLedgers,
    nonzeroOrphans,
    created: dryRun ? 0 : created,
    updated: dryRun ? 0 : updated,
  }

  console.log(`TOTALS ${JSON.stringify(totals)}`)
  console.log(`Done. Discrepancies: ${discrepancies}. Negatives: ${negativeLedgers}. Orphans(nonzero): ${nonzeroOrphans}. Created: ${totals.created}. Updated: ${totals.updated}.`)

  if (negativeLedgers || nonzeroOrphans) {
    console.error('Unresolved inconsistency — exit 2.')
    process.exitCode = 2
  }

  await mongoose.disconnect().catch(() => null)
}

main()
  .then(() => disconnectDatabase())
  .catch(async (error) => {
    console.error(error)
    await disconnectDatabase().catch(() => null)
    process.exit(1)
  })
