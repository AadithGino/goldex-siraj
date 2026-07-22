/**
 * Backfill SchemePaymentReference locks from paid scheme installments that have
 * a transaction reference (bank_transfer / card).
 *
 * Normalization: trim + uppercase (case-insensitive uniqueness).
 *
 * Default: dry-run (no writes). Require explicit --apply to insert missing locks.
 * Never deletes PaymentEvent or installment records.
 * Does not create scheme_installment_ref PaymentEvents.
 *
 * Usage (from backend workspace):
 *   npm run schemes:backfill-payment-refs:dry
 *   npm run schemes:backfill-payment-refs
 *
 * Exit codes:
 *   0 — no duplicate blockers (dry-run may still report missing locks)
 *   2 — duplicate normalized references block apply
 *   1 — unexpected error
 */
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { SchemeEnrollment, SchemePaymentReference } from '../src/models/scheme.models.js'
import { PaymentEvent } from '../src/models/commerce.models.js'
import {
  displaySchemeTransactionRef,
  normalizeSchemeTransactionRef,
} from '../src/services/scheme.dto.js'

const apply = process.argv.includes('--apply')

function collectPaidRefs(enrollments) {
  const rows = []
  for (const enrollment of enrollments) {
    for (const inst of enrollment.installments || []) {
      if (inst.paymentStatus !== 'paid') continue
      const display = displaySchemeTransactionRef(inst.transactionRef)
      if (!display) continue
      const method = inst.paymentMethod
      if (method !== 'bank_transfer' && method !== 'card') continue
      rows.push({
        enrollmentId: enrollment._id,
        installmentId: inst._id,
        displayReference: display,
        normalizedReference: normalizeSchemeTransactionRef(display),
        paymentMethod: method,
      })
    }
  }
  return rows
}

async function main() {
  await connectDatabase()
  console.log(`Scheme payment-reference backfill (${apply ? 'APPLY' : 'dry-run'})…`)
  if (apply) {
    console.log('NOTE: apply requires maintenance mode (no concurrent scheme installment payments).')
  }

  const enrollments = await SchemeEnrollment.find({
    'installments.paymentStatus': 'paid',
    'installments.transactionRef': { $exists: true, $nin: [null, ''] },
  }).lean()

  const paidRefs = collectPaidRefs(enrollments)
  const byNorm = new Map()
  for (const row of paidRefs) {
    const list = byNorm.get(row.normalizedReference) || []
    list.push(row)
    byNorm.set(row.normalizedReference, list)
  }

  const duplicates = [...byNorm.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([normalizedReference, list]) => ({
      normalized_reference: normalizedReference,
      count: list.length,
      installments: list.map((row) => ({
        enrollment_id: String(row.enrollmentId),
        installment_id: String(row.installmentId),
        display_reference: row.displayReference,
        payment_method: row.paymentMethod,
      })),
    }))

  const existingLocks = await SchemePaymentReference.find().lean()
  const existingByNorm = new Map(existingLocks.map((row) => [row.normalizedReference, row]))

  const missing = []
  for (const row of paidRefs) {
    if (duplicates.some((d) => d.normalized_reference === row.normalizedReference)) continue
    if (existingByNorm.has(row.normalizedReference)) continue
    missing.push(row)
  }

  // Orphan-ish: enrollment refs that point at missing installment IDs after deletes (report only)
  const danglingLocks = existingLocks.filter((lock) => {
    return !paidRefs.some(
      (row) => String(row.installmentId) === String(lock.installmentId)
        && row.normalizedReference === lock.normalizedReference,
    )
  })

  let inserted = 0
  if (apply && duplicates.length === 0) {
    for (const row of missing) {
      const event = await PaymentEvent.findOne({
        eventType: 'scheme_installment_paid',
        schemeInstallmentId: row.installmentId,
      }).select('_id').lean()
      await SchemePaymentReference.create({
        normalizedReference: row.normalizedReference,
        displayReference: row.displayReference,
        enrollmentId: row.enrollmentId,
        installmentId: row.installmentId,
        paymentEventId: event?._id,
      })
      inserted += 1
    }
  }

  const report = {
    mode: apply ? 'apply' : 'dry-run',
    paid_refs_scanned: paidRefs.length,
    duplicate_normalized_groups: duplicates.length,
    duplicates,
    missing_locks: missing.length,
    missing_sample: missing.slice(0, 20).map((row) => ({
      enrollment_id: String(row.enrollmentId),
      installment_id: String(row.installmentId),
      normalized_reference: row.normalizedReference,
      display_reference: row.displayReference,
    })),
    dangling_lock_rows: danglingLocks.length,
    inserted,
    note: 'Legacy scheme_installment_ref PaymentEvents are not deleted or created.',
  }
  console.log(JSON.stringify(report, null, 2))

  await disconnectDatabase()
  if (duplicates.length) process.exit(2)
  process.exit(0)
}

main().catch(async (error) => {
  console.error(error)
  try { await mongoose.disconnect() } catch { /* ignore */ }
  process.exit(1)
})
