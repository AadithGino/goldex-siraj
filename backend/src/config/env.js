import 'dotenv/config'
import { z } from 'zod'

const envBoolean = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return false
  if (typeof value === 'boolean') return value
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}, z.boolean())

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/goldex'),
  CLIENT_ORIGINS: z.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(32).default('development-access-secret-change-me-now'),
  JWT_REFRESH_SECRET: z.string().min(32).default('development-refresh-secret-change-me'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  COOKIE_SECURE: z.string().default('false'),
  OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(1800).default(600),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(10).default(5),
  OTP_PROVIDER: z.enum(['console', 'http']).default('console'),
  OTP_PROVIDER_API_KEY: z.string().optional(),
  OTP_PROVIDER_URL: z.string().url().optional(),
  SHOW_TEST_OTP: envBoolean.default(false),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('uploads'),
  STORAGE_PUBLIC_URL: z.string().url().default('http://localhost:4000/uploads'),
  // Preferred AWS_* names (match backend/.env). Legacy S3_* kept as aliases.
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_S3_PREFIX: z.string().optional(),
  AWS_S3_ENDPOINT: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PREFIX: z.string().optional(),
  JEWELLERY_ID: z.string().optional(),
  JEWELLERY_NAME: z.string().optional(),
  JEWELLERY_SLUG: z.string().optional(),
  /** Optional override for tenant folder, e.g. goldex1-jewellery */
  JEWELLERY_FOLDER: z.string().optional(),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  LOG_LEVEL: z.string().default('info'),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) throw new Error(`Invalid environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`)
const env = parsed.data

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value == null) continue
    const trimmed = String(value).trim()
    if (trimmed) return trimmed
  }
  return undefined
}

function normalizeS3Prefix(prefix) {
  if (!prefix) return ''
  return String(prefix).trim().replace(/^\/+|\/+$/g, '')
}

function sanitizePathSegment(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function resolveJewelleryFolder() {
  const explicit = sanitizePathSegment(env.JEWELLERY_FOLDER)
  if (explicit) return explicit
  const id = sanitizePathSegment(env.JEWELLERY_ID)
  const slug = sanitizePathSegment(env.JEWELLERY_SLUG)
  if (id && slug) return `${id}-${slug}`
  return id || slug || ''
}

const jewelleryFolder = resolveJewelleryFolder()

const s3Config = {
  region: firstNonEmpty(env.AWS_REGION, env.S3_REGION),
  bucket: firstNonEmpty(env.AWS_S3_BUCKET, env.S3_BUCKET),
  endpoint: firstNonEmpty(env.AWS_S3_ENDPOINT, env.S3_ENDPOINT),
  /** Root prefix only, e.g. jewellers — tenant + public/private are appended in storage.service */
  prefix: normalizeS3Prefix(firstNonEmpty(env.AWS_S3_PREFIX, env.S3_PREFIX)),
  jewelleryFolder,
  accessKeyId: firstNonEmpty(env.AWS_ACCESS_KEY_ID, env.S3_ACCESS_KEY_ID),
  secretAccessKey: firstNonEmpty(env.AWS_SECRET_ACCESS_KEY, env.S3_SECRET_ACCESS_KEY),
}

if (env.NODE_ENV === 'production') {
  if (env.JWT_ACCESS_SECRET.includes('development') || env.JWT_REFRESH_SECRET.includes('development')) {
    throw new Error('Production JWT secrets must be configured')
  }
  if (env.OTP_PROVIDER === 'console') throw new Error('Console OTP provider is forbidden in production')
  if (env.OTP_PROVIDER === 'http' && (!env.OTP_PROVIDER_URL || !env.OTP_PROVIDER_API_KEY)) throw new Error('Production OTP provider URL and API key are required')
  if (env.SHOW_TEST_OTP) throw new Error('SHOW_TEST_OTP is forbidden in production')
}

export const config = Object.freeze({
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  mongoUri: env.MONGODB_URI,
  clientOrigins: env.CLIENT_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean),
  jwt: { accessSecret: env.JWT_ACCESS_SECRET, refreshSecret: env.JWT_REFRESH_SECRET, accessTtl: env.JWT_ACCESS_TTL, refreshTtl: env.JWT_REFRESH_TTL },
  cookieSecure: env.COOKIE_SECURE === 'true',
  otp: {
    ttlSeconds: env.OTP_TTL_SECONDS,
    maxAttempts: env.OTP_MAX_ATTEMPTS,
    provider: env.OTP_PROVIDER,
    apiKey: env.OTP_PROVIDER_API_KEY,
    providerUrl: env.OTP_PROVIDER_URL,
    showTestOtp: env.SHOW_TEST_OTP,
  },
  jewellery: {
    id: firstNonEmpty(env.JEWELLERY_ID) || '',
    name: firstNonEmpty(env.JEWELLERY_NAME) || '',
    slug: firstNonEmpty(env.JEWELLERY_SLUG) || '',
    folder: jewelleryFolder,
  },
  storage: {
    driver: env.STORAGE_DRIVER,
    localPath: env.STORAGE_LOCAL_PATH,
    publicUrl: env.STORAGE_PUBLIC_URL,
    maxBytes: env.MAX_UPLOAD_BYTES,
    s3: s3Config,
  },
  logLevel: env.LOG_LEVEL,
})

/** Development-only: plaintext OTP may appear in API responses solely under these conditions. */
export function canExposeTestOtp(cfg = config) {
  return cfg.nodeEnv !== 'production' && cfg.otp.provider === 'console' && cfg.otp.showTestOtp === true
}
