import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3'
import mongoose from 'mongoose'
import { config } from '../config/env.js'
import { AppError } from '../utils/AppError.js'
import { INDEX_SPECS, findMatchingIndex, indexMatchesSpec } from '../../scripts/migrate-indexes.js'

const CACHE_TTL_MS = 8_000
const CHECK_TIMEOUT_MS = 5_000

let cache = { at: 0, value: null }

/** Subset of indexes that must exist for financial / auth correctness. */
const CRITICAL_INDEX_NAMES = new Set([
  'otpcodes_activeChallengeKey_unique',
  'refreshsessions_tokenHash_unique',
  'walletaccounts_customerId_unique',
  'wallettransactions_idempotencyKey_unique',
  'couponcustomerusages_coupon_customer_unique',
  'couponredemptions_coupon_order_unique',
  'orders_customer_idempotency_unique',
  'productimages_primary_unique',
  'goldrates_current_unique',
  'stonerates_current_unique',
  'stockmovements_idempotency_unique',
  'returnrequests_active_cancellation_unique',
  'returnrequests_active_whole_order_return_unique',
  'returncoordination_orderId_unique',
  'variants_metadata_idempotencyKey_unique',
  'paymentevents_transactionId_unique',
  'schemeenrollments_active_customer_scheme_unique',
  'schemepaymentreferences_normalizedReference_unique',
  'orders_invoiceNumber_unique',
])
function withTimeout(promise, ms, label) {
  let timer
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label}_timeout`)), ms)
    }),
  ])
}

/**
 * Fail fast on unsafe production configuration.
 */
export function assertProductionConfig(cfg = config) {
  if (cfg.nodeEnv !== 'production') return

  if (!cfg.cookieSecure) {
    throw new Error('COOKIE_SECURE must be true in production')
  }
  if (!cfg.clientOrigins.length) {
    throw new Error('CLIENT_ORIGINS must list at least one HTTPS origin in production')
  }
  for (const origin of cfg.clientOrigins) {
    if (origin === '*' || /localhost|127\.0\.0\.1/i.test(origin)) {
      throw new Error(`Unsafe CLIENT_ORIGINS entry in production: ${origin}`)
    }
  }
  if (cfg.storage.driver === 'local') {
    throw new Error('STORAGE_DRIVER=local is forbidden in production; use s3')
  }
  const s3 = cfg.storage.s3
  if (!s3.region || !s3.bucket || !s3.accessKeyId || !s3.secretAccessKey) {
    throw new Error('Production S3 storage configuration is incomplete')
  }
  if (cfg.otp.provider === 'console') {
    throw new Error('OTP_PROVIDER=console is forbidden in production')
  }
  if (cfg.otp.provider === 'http' && (!cfg.otp.providerUrl || !cfg.otp.apiKey)) {
    throw new Error('Production OTP HTTP provider URL and API key are required')
  }
  if (cfg.otp.showTestOtp) {
    throw new Error('SHOW_TEST_OTP is forbidden in production')
  }
}

/**
 * Refuse standalone mongod (transactions require a replica set / Atlas).
 */
export async function assertReplicaSetCapable(connection = mongoose.connection) {
  if (config.nodeEnv !== 'production') return
  if (connection.readyState !== 1) throw new Error('MongoDB is not connected')
  const hello = await connection.db.admin().command({ hello: 1 })
  if (!hello.setName) {
    throw new Error('Production MongoDB must be a replica set (transactions required)')
  }
}

function otpConfigStatus(cfg = config) {
  const status = {
    ok: true,
    provider: cfg.otp.provider,
    ttlSeconds: cfg.otp.ttlSeconds,
    maxAttempts: cfg.otp.maxAttempts,
  }
  if (cfg.nodeEnv === 'production') {
    if (cfg.otp.provider !== 'http') {
      status.ok = false
      status.reason = 'production_requires_http_otp'
    } else if (!cfg.otp.providerUrl || !cfg.otp.apiKey) {
      status.ok = false
      status.reason = 'otp_http_config_incomplete'
    } else if (cfg.otp.showTestOtp) {
      status.ok = false
      status.reason = 'show_test_otp_forbidden'
    }
  } else if (cfg.otp.provider === 'console') {
    status.note = 'console_otp_ok_non_production'
  } else if (cfg.otp.provider === 'http' && (!cfg.otp.providerUrl || !cfg.otp.apiKey)) {
    status.ok = false
    status.reason = 'otp_http_config_incomplete'
  }
  // Never include apiKey / secrets
  return status
}

async function checkCriticalIndexes(db) {
  const critical = INDEX_SPECS.filter((spec) => CRITICAL_INDEX_NAMES.has(spec.options.name))
  const missing = []
  const conflicts = []
  for (const spec of critical) {
    const coll = db.collection(spec.collection)
    let indexes = []
    try {
      indexes = await coll.indexes()
    } catch {
      missing.push(spec.options.name)
      continue
    }
    const byName = indexes.find((idx) => idx.name === spec.options.name)
    if (byName) {
      if (!indexMatchesSpec(byName, spec)) {
        conflicts.push(spec.options.name)
      }
      continue
    }
    const byShape = findMatchingIndex(indexes, spec)
    if (!byShape) missing.push(spec.options.name)
  }
  return { ok: missing.length === 0 && conflicts.length === 0, missing, conflicts }
}

async function checkS3(cfg = config) {
  if (cfg.storage.driver !== 's3') {
    return {
      ok: cfg.nodeEnv !== 'production',
      status: 'local_driver',
      skipped: true,
      note: cfg.nodeEnv === 'test' ? 's3_skipped_in_test' : 'local_storage',
    }
  }

  const s3 = cfg.storage.s3
  if (!s3.region || !s3.bucket || !s3.accessKeyId || !s3.secretAccessKey) {
    return { ok: false, status: 'config_incomplete', skipped: false }
  }

  // In test, skip live HeadBucket unless explicitly forced
  if (cfg.nodeEnv === 'test' && process.env.HEALTH_FORCE_S3 !== '1') {
    return {
      ok: true,
      status: 'skipped_in_test',
      skipped: true,
      bucketConfigured: true,
    }
  }

  try {
    const client = new S3Client({
      region: s3.region,
      endpoint: s3.endpoint,
      forcePathStyle: Boolean(s3.endpoint),
      credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
    })
    await withTimeout(
      client.send(new HeadBucketCommand({ Bucket: s3.bucket })),
      CHECK_TIMEOUT_MS,
      's3_head_bucket',
    )
    return { ok: true, status: 'head_bucket_ok', skipped: false }
  } catch (error) {
    return {
      ok: false,
      status: 'head_bucket_failed',
      skipped: false,
      error: error.message?.includes('timeout') ? 'timeout' : 'unreachable',
    }
  }
}

async function computeReadiness(cfg = config) {
  const checks = {
    mongo: false,
    replica_set: false,
    transactions: false,
    storage: false,
    config: true,
    indexes: false,
    otp: false,
  }
  const details = {}

  if (cfg.nodeEnv === 'production') {
    try {
      assertProductionConfig(cfg)
    } catch (error) {
      checks.config = false
      details.config = error.message
    }
  }

  const otp = otpConfigStatus(cfg)
  checks.otp = otp.ok
  details.otp = otp

  if (mongoose.connection.readyState === 1) {
    checks.mongo = true
    try {
      const hello = await withTimeout(
        mongoose.connection.db.admin().command({ hello: 1 }),
        CHECK_TIMEOUT_MS,
        'mongo_hello',
      )
      checks.replica_set = Boolean(hello.setName)
      details.mongo_version = hello.version
      details.replica_set = hello.setName || null
    } catch (error) {
      details.mongo_error = error.message?.includes('timeout') ? 'timeout' : 'hello_failed'
    }

    try {
      const session = await mongoose.startSession()
      try {
        session.startTransaction()
        await withTimeout(
          mongoose.connection.db.collection('_health_probe').insertOne(
            { t: new Date(), probe: true },
            { session },
          ),
          CHECK_TIMEOUT_MS,
          'txn_probe',
        )
        await session.abortTransaction()
        checks.transactions = true
      } catch (error) {
        details.transaction_error = error.message?.includes('timeout') ? 'timeout' : 'txn_failed'
        try { await session.abortTransaction() } catch { /* ignore */ }
      } finally {
        session.endSession()
      }
    } catch (error) {
      details.transaction_error = error.message
    }

    try {
      const indexResult = await withTimeout(
        checkCriticalIndexes(mongoose.connection.db),
        CHECK_TIMEOUT_MS,
        'indexes',
      )
      checks.indexes = indexResult.ok
      if (!indexResult.ok) {
        if (indexResult.missing?.length) details.missing_indexes = indexResult.missing
        if (indexResult.conflicts?.length) details.conflict_indexes = indexResult.conflicts
      }
    } catch (error) {
      checks.indexes = false
      details.indexes_error = error.message?.includes('timeout') ? 'timeout' : 'index_check_failed'
    }
  } else {
    details.mongo_ready_state = mongoose.connection.readyState
  }

  const storage = await checkS3(cfg)
  checks.storage = storage.ok
  details.storage = {
    driver: cfg.storage.driver,
    status: storage.status,
    skipped: Boolean(storage.skipped),
    ...(storage.note ? { note: storage.note } : {}),
    ...(storage.error ? { error: storage.error } : {}),
  }

  // In non-production test/dev without migrate:indexes, index gaps should not false-fail
  // local replica-set integration suites that never created named indexes — require indexes
  // only when production, or when HEALTH_REQUIRE_INDEXES=1.
  const requireIndexes = cfg.nodeEnv === 'production' || process.env.HEALTH_REQUIRE_INDEXES === '1'
  if (!requireIndexes && !checks.indexes) {
    details.indexes_optional = true
    checks.indexes = true
  }

  const ready = checks.mongo
    && checks.transactions
    && checks.storage
    && checks.config
    && checks.otp
    && checks.indexes
    && (cfg.nodeEnv !== 'production' || checks.replica_set)

  return {
    ready,
    checks,
    details,
    timezone: 'Asia/Dubai',
    cached: false,
  }
}

/**
 * Readiness probe for load balancers / deploy gates.
 * Cached briefly to avoid stampeding Mongo/S3 on frequent probes.
 */
export async function getReadiness(cfg = config, { bypassCache = false } = {}) {
  const now = Date.now()
  if (!bypassCache && cache.value && now - cache.at < CACHE_TTL_MS) {
    return { ...cache.value, cached: true }
  }

  const value = await computeReadiness(cfg)
  cache = { at: now, value }
  return value
}

/** Test helper — clear readiness cache. */
export function clearReadinessCache() {
  cache = { at: 0, value: null }
}

export async function requireReady() {
  const result = await getReadiness()
  if (!result.ready) throw new AppError(503, 'NOT_READY', 'Service is not ready', result)
  return result
}
