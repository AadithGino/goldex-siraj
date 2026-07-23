import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config } from '../config/env.js'
import { AppError } from '../utils/AppError.js'
import { assertSafeUpload } from '../utils/fileSignature.js'

/**
 * Bucket layout:
 *   {AWS_S3_PREFIX}/{JEWELLERY_ID}-{JEWELLERY_SLUG}/public|private/{folder}/...
 */
const UPLOAD_KINDS = {
  product: { visibility: 'public', folder: 'product-images' },
  banner: { visibility: 'public', folder: 'banner-images' },
  video: { visibility: 'public', folder: 'product-videos' },
  certificate: { visibility: 'private', folder: 'product-certificates' },
  return: { visibility: 'private', folder: 'return-proof-images' },
}

const extensions = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
}

const DEFAULT_SIGNED_TTL = 60 * 60 // 1 hour (console links often use 300s; longer is better for UI)

/** @param {string} kind */
export function resolveUploadKind(kind) {
  const meta = UPLOAD_KINDS[kind]
  if (!meta) throw new AppError(422, 'INVALID_UPLOAD_KIND', 'Unsupported upload kind')
  return meta
}

/**
 * Build object key matching the jewellers/{tenant}/public|private/... tree.
 */
export function buildObjectKey(kind, mime, { now = new Date() } = {}) {
  const meta = resolveUploadKind(kind)
  const ext = extensions[mime]
  if (!ext) throw new AppError(415, 'INVALID_FILE_TYPE', 'Unsupported file type')

  const date = now.toISOString().slice(0, 10)
  const leaf = `${meta.folder}/${date}/${randomUUID()}${ext}`
  const parts = [
    config.storage.s3.prefix,
    config.storage.s3.jewelleryFolder || config.jewellery.folder,
    meta.visibility,
    leaf,
  ].filter(Boolean)

  return parts.join('/')
}

function signedTtlSeconds() {
  const raw = Number(process.env.AWS_S3_SIGNED_URL_TTL || process.env.S3_SIGNED_URL_TTL || DEFAULT_SIGNED_TTL)
  if (!Number.isFinite(raw) || raw < 60) return DEFAULT_SIGNED_TTL
  return Math.min(Math.floor(raw), 7 * 24 * 60 * 60)
}

function getS3() {
  const s3 = config.storage.s3
  if (!s3.region || !s3.bucket || !s3.accessKeyId || !s3.secretAccessKey) {
    throw new Error('S3 storage configuration is incomplete (need AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)')
  }
  return new S3Client({
    region: s3.region,
    ...(s3.endpoint ? { endpoint: s3.endpoint, forcePathStyle: true } : {}),
    credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
  })
}

/** Canonical unsigned object URL (not fetchable if the bucket is private). */
export function canonicalObjectUrl(key) {
  if (!key) return null
  const s3 = config.storage.s3
  if (config.storage.driver !== 's3') {
    return `${config.storage.publicUrl.replace(/\/$/, '')}/${key}`
  }
  const publicBase = String(config.storage.publicUrl || '').replace(/\/$/, '')
  if (publicBase && !/localhost|127\.0\.0\.1/i.test(publicBase)) {
    return `${publicBase}/${key}`
  }
  if (s3.endpoint) {
    return `${s3.endpoint.replace(/\/$/, '')}/${s3.bucket}/${key}`
  }
  return `https://${s3.bucket}.s3.${s3.region}.amazonaws.com/${key}`
}

/**
 * Extract a storage object key from a bare key, canonical S3 URL, or expired signed URL.
 */
export function extractStorageKey(value) {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null

  // Already a key (no scheme)
  if (!/^https?:\/\//i.test(raw)) {
    return raw.replace(/^\/+/, '').split('?')[0] || null
  }

  let url
  try {
    url = new URL(raw)
  } catch {
    return null
  }

  const s3 = config.storage.s3
  const host = url.hostname.toLowerCase()
  let key = decodeURIComponent(url.pathname.replace(/^\/+/, ''))

  // Path-style: endpoint/bucket/key or s3.region.amazonaws.com/bucket/key
  if (s3.bucket && (key === s3.bucket || key.startsWith(`${s3.bucket}/`))) {
    key = key.slice(s3.bucket.length).replace(/^\/+/, '')
  }

  // Virtual-hosted–style: bucket.s3.region.amazonaws.com/key
  if (s3.bucket && host.startsWith(`${s3.bucket.toLowerCase()}.`)) {
    // pathname already is the key
  }

  return key || null
}

export function isOurStorageObject(value) {
  const key = extractStorageKey(value)
  if (!key) return false
  const prefix = config.storage.s3.prefix
  const tenant = config.storage.s3.jewelleryFolder || config.jewellery.folder
  if (prefix && tenant) return key.startsWith(`${prefix}/${tenant}/`)
  if (prefix) return key.startsWith(`${prefix}/`)
  return key.includes('/public/') || key.includes('/private/')
}

/**
 * Presigned GET URL (works with private buckets). Matches console-style inline links.
 */
export async function getSignedObjectUrl(keyOrUrl, {
  expiresIn = signedTtlSeconds(),
  contentDisposition = 'inline',
} = {}) {
  const key = extractStorageKey(keyOrUrl)
  if (!key) return null

  if (config.storage.driver !== 's3') {
    return canonicalObjectUrl(key)
  }

  const client = getS3()
  const command = new GetObjectCommand({
    Bucket: config.storage.s3.bucket,
    Key: key,
    ...(contentDisposition ? { ResponseContentDisposition: contentDisposition } : {}),
  })
  return getSignedUrl(client, command, { expiresIn })
}

/**
 * Deep-walk JSON-ish payloads and replace our S3 object refs with fresh signed URLs.
 * Safe for local driver (no-op passthrough via getSignedObjectUrl).
 */
export async function signMediaUrls(value, { cache = new Map() } = {}) {
  if (value == null) return value
  if (typeof value === 'string') {
    if (!isOurStorageObject(value)) return value
    const key = extractStorageKey(value)
    if (!key) return value
    if (cache.has(key)) return cache.get(key)
    const signed = await getSignedObjectUrl(key)
    cache.set(key, signed || value)
    return cache.get(key)
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => signMediaUrls(item, { cache })))
  }
  if (typeof value !== 'object') return value
  if (value instanceof Date) return value
  const out = {}
  for (const [k, v] of Object.entries(value)) {
    out[k] = await signMediaUrls(v, { cache })
  }
  return out
}

export async function upload(kind, file) {
  if (!file) throw new AppError(422, 'FILE_REQUIRED', 'A file is required')
  if (file.size > config.storage.maxBytes || (file.buffer && file.buffer.length > config.storage.maxBytes)) {
    throw new AppError(413, 'FILE_TOO_LARGE', 'Uploaded file exceeds the maximum allowed size')
  }
  const meta = resolveUploadKind(kind)
  const mime = await assertSafeUpload(kind, file)
  const key = buildObjectKey(kind, mime)
  const storageUrl = canonicalObjectUrl(key)

  try {
    if (config.storage.driver === 's3') {
      await getS3().send(new PutObjectCommand({
        Bucket: config.storage.s3.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: mime,
        CacheControl: meta.visibility === 'public'
          ? 'public,max-age=31536000,immutable'
          : 'private,no-cache',
      }))
      const signedUrl = await getSignedObjectUrl(key)
      return {
        key,
        /** Persist this (or `key`) in DB — never persist a signed URL. */
        storage_url: storageUrl,
        /** Fresh signed URL for immediate preview / <img src>. */
        url: signedUrl,
        mime,
        visibility: meta.visibility,
        expires_in: signedTtlSeconds(),
      }
    }
    const target = path.resolve(config.storage.localPath, key)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, file.buffer, { flag: 'wx' })
    return {
      key,
      storage_url: storageUrl,
      url: storageUrl,
      mime,
      visibility: meta.visibility,
      expires_in: null,
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw error
  }
}

export async function removeObject(keyOrUrl) {
  const key = extractStorageKey(keyOrUrl)
  if (!key) return
  if (config.storage.driver === 's3') {
    await getS3().send(new DeleteObjectCommand({ Bucket: config.storage.s3.bucket, Key: key }))
    return
  }
  const target = path.resolve(config.storage.localPath, key)
  await unlink(target).catch(() => null)
}
