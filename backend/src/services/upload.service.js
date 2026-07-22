import { logger } from '../config/logger.js'
import { PendingUpload } from '../models/upload.models.js'
import { AppError } from '../utils/AppError.js'
import { removeObject, upload as storeUpload } from './storage.service.js'

const RETURN_PROOF_TTL_MS = 24 * 60 * 60 * 1000
const MAX_PENDING_PER_CUSTOMER = 20

/**
 * Store a return-proof file and register it as a short-lived pending upload owned by the customer.
 */
export async function uploadReturnProof(customerId, file) {
  const recent = await PendingUpload.countDocuments({
    customerId,
    kind: 'return',
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
  if (recent >= MAX_PENDING_PER_CUSTOMER) {
    throw new AppError(429, 'UPLOAD_LIMIT', 'Too many unused return proof uploads; submit a return or wait for expiry')
  }

  const stored = await storeUpload('return', file)
  const pending = await PendingUpload.create({
    customerId,
    kind: 'return',
    key: stored.key,
    url: stored.url,
    mime: stored.mime,
    status: 'pending',
    expiresAt: new Date(Date.now() + RETURN_PROOF_TTL_MS),
  })

  return {
    id: pending.id,
    key: pending.key,
    url: pending.url,
    mime: pending.mime,
    expires_at: pending.expiresAt,
  }
}

/**
 * Claim proofs inside an open Mongo session. Each update requires pending + owner + not expired.
 * Matched count must equal unique proof count or the transaction aborts.
 */
export async function claimReturnProofsInSession(customerId, proofs = [], returnRequestId, session) {
  if (!Array.isArray(proofs) || proofs.length === 0) return []
  if (proofs.length > 10) throw new AppError(422, 'TOO_MANY_PROOFS', 'At most 10 proof files are allowed')
  if (!returnRequestId) throw new AppError(422, 'RETURN_REQUIRED', 'return request id is required to claim proofs')

  const identifiers = [...new Set(proofs.map((value) => String(value || '').trim()).filter(Boolean))]
  const claimedUrls = []

  for (const identifier of identifiers) {
    const updated = await PendingUpload.findOneAndUpdate(
      {
        customerId,
        kind: 'return',
        status: 'pending',
        expiresAt: { $gt: new Date() },
        returnRequestId: null,
        $or: [{ key: identifier }, { url: identifier }],
      },
      { $set: { status: 'attached', returnRequestId } },
      { new: true, session },
    )
    if (!updated) {
      throw new AppError(422, 'INVALID_PROOF', 'One or more return proof uploads are missing, expired, or not yours')
    }
    claimedUrls.push(updated.url)
  }

  if (claimedUrls.length !== identifiers.length) {
    throw new AppError(422, 'INVALID_PROOF', 'One or more return proof uploads are missing, expired, or not yours')
  }
  return claimedUrls
}

/**
 * Delete expired unattached return proofs from storage and mark expired.
 */
export async function cleanupExpiredReturnProofs({ dryRun = false } = {}) {
  const expired = await PendingUpload.find({
    status: 'pending',
    expiresAt: { $lte: new Date() },
  }).limit(500)

  let removed = 0
  let failed = 0
  for (const row of expired) {
    if (!dryRun) {
      try {
        await removeObject(row.key)
        row.status = 'expired'
        await row.save()
        removed += 1
      } catch (error) {
        failed += 1
        logger.error({ err: error, key: row.key }, 'Failed to delete expired return proof; will retry')
      }
    } else {
      removed += 1
    }
  }
  return { scanned: expired.length, removed, failed, dryRun }
}

/**
 * Detect attached proofs whose return request is missing (orphan reconciliation).
 */
export async function reconcileOrphanAttachedProofs({ dryRun = true } = {}) {
  const { ReturnRequest } = await import('../models/commerce.models.js')
  const attached = await PendingUpload.find({ status: 'attached' }).limit(1000)
  const orphans = []
  for (const row of attached) {
    if (!row.returnRequestId) {
      orphans.push({ id: row.id, key: row.key, reason: 'missing_return_request_id' })
      continue
    }
    const exists = await ReturnRequest.exists({ _id: row.returnRequestId })
    if (!exists) orphans.push({ id: row.id, key: row.key, reason: 'return_request_missing' })
  }
  if (!dryRun) {
    for (const orphan of orphans) {
      await PendingUpload.updateOne({ _id: orphan.id }, { $set: { status: 'expired' } })
    }
  }
  return { scanned: attached.length, orphans: orphans.length, details: orphans, dryRun }
}
