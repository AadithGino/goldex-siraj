import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config } from '../config/env.js'
import { AppError } from '../utils/AppError.js'
import { assertAllowedDeclaredMime, assertSafeUpload } from '../utils/fileSignature.js'
import { optimizeUploadImage } from '../utils/imageOptimize.js'
import { logger } from '../config/logger.js'

/**
 * Bucket layout:
 *   {AWS_S3_PREFIX}/{JEWELLERY_ID}-{JEWELLERY_SLUG}/public|private/{folder}/...
 */
const UPLOAD_KINDS = {
  product: { visibility: 'public', folder: 'product-images' },
  banner: { visibility: 'public', folder: 'banner-images' },
  category: { visibility: 'public', folder: 'category-images' },
  video: { visibility: 'public', folder: 'product-videos' },
  certificate: { visibility: 'private', folder: 'product-certificates' },
  return: { visibility: 'private', folder: 'return-proof-images' },
  'scheme-id-proof': { visibility: 'private', folder: 'scheme-id-proof-images' },
  'custom-jewellery': { visibility: 'private', folder: 'custom-jewellery-images' },
  'sell-jewellery': { visibility: 'private', folder: 'sell-jewellery-images' },
  'sell-invoice': { visibility: 'private', folder: 'sell-invoice-files' },
}

/** Customer kinds that may use direct-to-S3 presigned PUT. */
export const CUSTOMER_PRESIGN_KINDS = new Set([
  'custom-jewellery',
  'sell-jewellery',
  'sell-invoice',
])

const CUSTOMER_PROXY_PATHS = {
  'custom-jewellery': '/customer/media/custom-jewellery',
  'sell-jewellery': '/customer/media/sell-jewellery',
  'sell-invoice': '/customer/media/sell-invoice',
}

const extensions = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
}

const DEFAULT_SIGNED_TTL = 60 * 60
/** Short-lived PUT URLs for browser → S3 uploads. */
const PRESIGN_PUT_TTL = 15 * 60
/** Reuse signed URLs so browsers can cache (new signature every response defeats cache). */
const signedUrlCache = new Map()

/** @param {string} kind */
export function resolveUploadKind(kind) {
  const meta = UPLOAD_KINDS[kind]
  if (!meta) throw new AppError(422, 'INVALID_UPLOAD_KIND', 'Unsupported upload kind')
  return meta
}

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

export function extractStorageKey(value) {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null

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
  let key = decodeURIComponent(url.pathname.replace(/^\/+/, ''))

  if (s3.bucket && (key === s3.bucket || key.startsWith(`${s3.bucket}/`))) {
    key = key.slice(s3.bucket.length).replace(/^\/+/, '')
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

export async function getSignedObjectUrl(keyOrUrl, {
  expiresIn = signedTtlSeconds(),
  contentDisposition = 'inline',
} = {}) {
  const key = extractStorageKey(keyOrUrl)
  if (!key) return null

  if (config.storage.driver !== 's3') {
    return canonicalObjectUrl(key)
  }

  const cached = signedUrlCache.get(key)
  if (cached && cached.expiresAt > Date.now() + 120_000) {
    return cached.url
  }

  const client = getS3()
  const command = new GetObjectCommand({
    Bucket: config.storage.s3.bucket,
    Key: key,
    ...(contentDisposition ? { ResponseContentDisposition: contentDisposition } : {}),
    ResponseCacheControl: `private, max-age=${Math.min(expiresIn, 3600)}`,
  })
  const url = await getSignedUrl(client, command, { expiresIn })
  signedUrlCache.set(key, { url, expiresAt: Date.now() + expiresIn * 1000 })

  if (signedUrlCache.size > 2000) {
    const now = Date.now()
    for (const [k, v] of signedUrlCache) {
      if (v.expiresAt <= now) signedUrlCache.delete(k)
    }
  }
  return url
}

const STORAGE_KEY_FIELDS = new Set(['key', 'storage_url', 'storageUrl'])

function isStorageKeyField(fieldName) {
  return STORAGE_KEY_FIELDS.has(fieldName) || /(?:_key|Key)$/.test(fieldName)
}

/**
 * Replace displayable media refs with signed GET URLs.
 * Persistent fields (`key`, `storage_url`, `*_key`) are left unchanged so clients
 * can resubmit them; objects with a storage `key` also get a signed `url`.
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
    if (typeof v === 'string' && isStorageKeyField(k)) {
      out[k] = v
      continue
    }
    out[k] = await signMediaUrls(v, { cache })
  }

  const rawKey = typeof out.key === 'string'
    ? out.key
    : (typeof out.storage_url === 'string' ? out.storage_url : null)
  if (rawKey && isOurStorageObject(rawKey)) {
    const key = extractStorageKey(rawKey)
    if (key) {
      if (cache.has(key)) out.url = cache.get(key)
      else {
        const signed = await getSignedObjectUrl(key)
        cache.set(key, signed || rawKey)
        out.url = cache.get(key)
      }
    }
  }

  return out
}

/**
 * Issue a browser→S3 PUT URL for customer private uploads.
 * When STORAGE_DRIVER=local, returns mode=proxy so the client uses multipart to the API.
 */
export async function createPresignedUpload(kind, { contentType, contentLength } = {}) {
  if (!CUSTOMER_PRESIGN_KINDS.has(kind)) {
    throw new AppError(422, 'INVALID_UPLOAD_KIND', 'This upload kind does not support presigned upload')
  }
  const meta = resolveUploadKind(kind)
  const mime = assertAllowedDeclaredMime(kind, contentType)
  const size = Number(contentLength)
  if (!Number.isFinite(size) || size <= 0) {
    throw new AppError(422, 'CONTENT_LENGTH_REQUIRED', 'content_length must be a positive number')
  }
  if (size > config.storage.maxBytes) {
    throw new AppError(413, 'FILE_TOO_LARGE', 'Uploaded file exceeds the maximum allowed size')
  }

  if (config.storage.driver !== 's3') {
    return {
      mode: 'proxy',
      kind,
      upload_path: CUSTOMER_PROXY_PATHS[kind],
      content_type: mime,
      max_bytes: config.storage.maxBytes,
      expires_in: null,
    }
  }

  const key = buildObjectKey(kind, mime)
  const storageUrl = canonicalObjectUrl(key)
  const expiresIn = PRESIGN_PUT_TTL
  const client = getS3()
  const command = new PutObjectCommand({
    Bucket: config.storage.s3.bucket,
    Key: key,
    ContentType: mime,
    CacheControl: meta.visibility === 'public'
      ? 'public,max-age=31536000,immutable'
      : 'private, max-age=3600',
  })
  const uploadUrl = await getSignedUrl(client, command, { expiresIn })

  return {
    mode: 's3',
    kind,
    key,
    upload_url: uploadUrl,
    method: 'PUT',
    headers: { 'content-type': mime },
    storage_url: storageUrl,
    content_type: mime,
    max_bytes: config.storage.maxBytes,
    visibility: meta.visibility,
    expires_in: expiresIn,
  }
}

export async function upload(kind, file) {
  if (!file) throw new AppError(422, 'FILE_REQUIRED', 'A file is required')
  if (file.size > config.storage.maxBytes || (file.buffer && file.buffer.length > config.storage.maxBytes)) {
    throw new AppError(413, 'FILE_TOO_LARGE', 'Uploaded file exceeds the maximum allowed size')
  }
  const meta = resolveUploadKind(kind)
  const detectedMime = await assertSafeUpload(kind, file)
  const optimized = await optimizeUploadImage(kind, file.buffer, detectedMime)
  if (optimized.bytesOut < optimized.bytesIn) {
    logger.info({
      kind,
      bytesIn: optimized.bytesIn,
      bytesOut: optimized.bytesOut,
      mime: optimized.mime,
      width: optimized.width,
      height: optimized.height,
    }, 'upload image optimized')
  }
  if (optimized.buffer.length > config.storage.maxBytes) {
    throw new AppError(413, 'FILE_TOO_LARGE', 'Optimized file still exceeds the maximum allowed size')
  }

  const mime = optimized.mime
  const body = optimized.buffer
  const key = buildObjectKey(kind, mime)
  const storageUrl = canonicalObjectUrl(key)

  try {
    if (config.storage.driver === 's3') {
      await getS3().send(new PutObjectCommand({
        Bucket: config.storage.s3.bucket,
        Key: key,
        Body: body,
        ContentType: mime,
        CacheControl: meta.visibility === 'public'
          ? 'public,max-age=31536000,immutable'
          : 'private, max-age=3600',
      }))
      const signedUrl = await getSignedObjectUrl(key)
      return {
        key,
        storage_url: storageUrl,
        url: signedUrl,
        mime,
        visibility: meta.visibility,
        expires_in: signedTtlSeconds(),
        optimized: {
          bytes_in: optimized.bytesIn,
          bytes_out: optimized.bytesOut,
        },
      }
    }
    const target = path.resolve(config.storage.localPath, key)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, body, { flag: 'wx' })
    return {
      key,
      storage_url: storageUrl,
      url: storageUrl,
      mime,
      visibility: meta.visibility,
      expires_in: null,
      optimized: {
        bytes_in: optimized.bytesIn,
        bytes_out: optimized.bytesOut,
      },
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
    signedUrlCache.delete(key)
    return
  }
  const target = path.resolve(config.storage.localPath, key)
  await unlink(target).catch(() => null)
}
