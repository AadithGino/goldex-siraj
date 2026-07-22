import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { config } from '../config/env.js'
import { AppError } from '../utils/AppError.js'
import { assertSafeUpload } from '../utils/fileSignature.js'

const folders = { product: 'product-images', certificate: 'product-certificates', banner: 'banner-images', return: 'return-proof-images' }
const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' }

function buildKey(kind, mime) {
  const folder = folders[kind]
  if (!folder) throw new AppError(422, 'INVALID_UPLOAD_KIND', 'Unsupported upload kind')
  const ext = extensions[mime]
  if (!ext) throw new AppError(415, 'INVALID_FILE_TYPE', 'Unsupported file type')
  return `${folder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${ext}`
}

function getS3() {
  const s3 = config.storage.s3
  if (!s3.region || !s3.bucket || !s3.accessKeyId || !s3.secretAccessKey) throw new Error('S3 storage configuration is incomplete')
  return new S3Client({ region: s3.region, endpoint: s3.endpoint, forcePathStyle: Boolean(s3.endpoint), credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey } })
}

export async function upload(kind, file) {
  if (!file) throw new AppError(422, 'FILE_REQUIRED', 'A file is required')
  if (file.size > config.storage.maxBytes || (file.buffer && file.buffer.length > config.storage.maxBytes)) {
    throw new AppError(413, 'FILE_TOO_LARGE', 'Uploaded file exceeds the maximum allowed size')
  }
  const mime = await assertSafeUpload(kind, file)
  const key = buildKey(kind, mime)

  try {
    if (config.storage.driver === 's3') {
      await getS3().send(new PutObjectCommand({
        Bucket: config.storage.s3.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: mime,
        CacheControl: 'public,max-age=31536000,immutable',
      }))
      const base = config.storage.s3.endpoint
        ? `${config.storage.s3.endpoint.replace(/\/$/, '')}/${config.storage.s3.bucket}`
        : `https://${config.storage.s3.bucket}.s3.${config.storage.s3.region}.amazonaws.com`
      return { key, url: `${base}/${key}`, mime }
    }
    const target = path.resolve(config.storage.localPath, key)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, file.buffer, { flag: 'wx' })
    return { key, url: `${config.storage.publicUrl.replace(/\/$/, '')}/${key}`, mime }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw error
  }
}

export async function removeObject(key) {
  if (!key) return
  if (config.storage.driver === 's3') {
    await getS3().send(new DeleteObjectCommand({ Bucket: config.storage.s3.bucket, Key: key }))
    return
  }
  const target = path.resolve(config.storage.localPath, key)
  await unlink(target).catch(() => null)
}
