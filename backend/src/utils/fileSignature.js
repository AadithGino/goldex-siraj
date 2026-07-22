import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'
import { AppError } from './AppError.js'
import { MAX_PDF_BYTES, parseAndInspectPdf } from './pdfInspect.js'

const MAX_IMAGE_WIDTH = 8000
const MAX_IMAGE_HEIGHT = 8000
const MAX_PIXELS = 40_000_000
const PDF_PARSE_TIMEOUT_MS = 5000

const WORKER_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pdfParse.worker.js')

/**
 * Detect file type from magic bytes (not client-supplied MIME/extension).
 * Returns canonical MIME or null.
 */
export function detectMimeFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png'
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
    && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return 'image/webp'
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'application/pdf'
  return null
}

const KIND_ALLOWED = {
  product: new Set(['image/jpeg', 'image/png', 'image/webp']),
  banner: new Set(['image/jpeg', 'image/png', 'image/webp']),
  return: new Set(['image/jpeg', 'image/png', 'image/webp']),
  certificate: new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
}

async function assertDecodableImage(buffer) {
  try {
    const image = sharp(buffer, {
      failOn: 'warning',
      limitInputPixels: MAX_PIXELS,
      sequentialRead: true,
    })
    const meta = await image.metadata()
    if (!meta.width || !meta.height) {
      throw new AppError(415, 'INVALID_IMAGE', 'Image dimensions could not be determined')
    }
    if (meta.width > MAX_IMAGE_WIDTH || meta.height > MAX_IMAGE_HEIGHT) {
      throw new AppError(415, 'IMAGE_TOO_LARGE', `Image dimensions exceed ${MAX_IMAGE_WIDTH}x${MAX_IMAGE_HEIGHT}`)
    }
    if (meta.width * meta.height > MAX_PIXELS) {
      throw new AppError(415, 'IMAGE_TOO_LARGE', 'Image pixel count exceeds the allowed maximum')
    }
    await image.rotate().toBuffer({ resolveWithObject: false })
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(415, 'INVALID_IMAGE', 'Image could not be decoded safely')
  }
}

function parsePdfInWorker(buffer) {
  return new Promise((resolve, reject) => {
    let settled = false
    let timer
    const worker = new Worker(WORKER_PATH, {
      workerData: { buffer },
    })

    const finish = (err, value) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      worker.terminate().catch(() => {})
      if (err) reject(err)
      else resolve(value)
    }

    timer = setTimeout(() => {
      finish(new AppError(415, 'PDF_TIMEOUT', 'PDF parsing timed out'))
    }, PDF_PARSE_TIMEOUT_MS)

    worker.on('message', (msg) => {
      if (msg?.ok) finish(null, true)
      else {
        finish(new AppError(
          msg?.status || 415,
          msg?.code || 'INVALID_PDF',
          msg?.message || 'PDF could not be parsed',
        ))
      }
    })
    worker.on('error', () => finish(new AppError(415, 'INVALID_PDF', 'PDF could not be parsed')))
    worker.on('exit', (code) => {
      if (!settled && code !== 0) {
        finish(new AppError(415, 'PDF_TIMEOUT', 'PDF parsing timed out'))
      }
    })
  })
}

async function assertBoundedPdf(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5) {
    throw new AppError(415, 'INVALID_PDF', 'PDF header is missing')
  }
  if (buffer.length > MAX_PDF_BYTES) {
    throw new AppError(415, 'PDF_TOO_LARGE', `PDF exceeds ${MAX_PDF_BYTES} bytes`)
  }
  const header = buffer.subarray(0, Math.min(buffer.length, 8)).toString('latin1')
  if (!header.startsWith('%PDF-')) {
    throw new AppError(415, 'INVALID_PDF', 'PDF header is missing')
  }

  try {
    return await parsePdfInWorker(buffer)
  } catch (error) {
    if (error instanceof AppError) throw error
    return parseAndInspectPdf(buffer)
  }
}

/**
 * Validate upload content. Rejects MIME mismatches, corrupt images, and unsafe PDFs.
 * @returns {Promise<string>} detected MIME
 */
export async function assertSafeUpload(kind, file) {
  if (!file?.buffer) throw new AppError(422, 'FILE_REQUIRED', 'A file is required')
  const detected = detectMimeFromBuffer(file.buffer)
  if (!detected) throw new AppError(415, 'INVALID_FILE_SIGNATURE', 'File content signature is not allowed')

  const allowed = KIND_ALLOWED[kind]
  if (!allowed || !allowed.has(detected)) {
    throw new AppError(415, 'INVALID_FILE_TYPE', `File type ${detected} is not allowed for ${kind}`)
  }

  if (
    file.mimetype
    && file.mimetype !== 'application/octet-stream'
    && file.mimetype !== detected
  ) {
    throw new AppError(415, 'MIME_MISMATCH', 'Declared MIME type does not match file contents')
  }

  if (detected.startsWith('image/')) {
    const sample = file.buffer.subarray(0, Math.min(file.buffer.length, 64 * 1024)).toString('latin1')
    if (/<\s*script/i.test(sample) || /<\?php/i.test(sample)) {
      throw new AppError(415, 'UNSAFE_FILE_CONTENT', 'File contains disallowed embedded content')
    }
    await assertDecodableImage(file.buffer)
  } else if (detected === 'application/pdf') {
    await assertBoundedPdf(file.buffer)
  }

  return detected
}

export { parseAndInspectPdf, inspectPdfSafety } from './pdfInspect.js'
