import sharp from 'sharp'
import { AppError } from './AppError.js'

/**
 * Per-kind web delivery caps. Studio jewellery shots are often 4–12MB PNGs;
 * we downscale + convert to WebP so catalogue pages stay fast.
 */
const PRESETS = {
  product: { maxEdge: 1600, quality: 80 },
  /** Full-bleed / mid-page marketing banners */
  banner: { maxEdge: 1920, quality: 78 },
  /** Category strip / grid tiles — much smaller on screen */
  category: { maxEdge: 800, quality: 78 },
  return: { maxEdge: 1600, quality: 78 },
  certificate: { maxEdge: 2000, quality: 85 },
}

/**
 * @param {string} kind
 * @param {Buffer} buffer
 * @param {string} mime
 * @returns {Promise<{ buffer: Buffer, mime: string, width?: number, height?: number, bytesIn: number, bytesOut: number }>}
 */
export async function optimizeUploadImage(kind, buffer, mime) {
  if (!mime?.startsWith('image/')) {
    return { buffer, mime, bytesIn: buffer.length, bytesOut: buffer.length }
  }
  const preset = PRESETS[kind]
  if (!preset) {
    return { buffer, mime, bytesIn: buffer.length, bytesOut: buffer.length }
  }

  try {
    const image = sharp(buffer, {
      failOn: 'warning',
      limitInputPixels: 40_000_000,
      sequentialRead: true,
    }).rotate()

    const meta = await image.metadata()
    const pipeline = image
      .resize({
        width: preset.maxEdge,
        height: preset.maxEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality: preset.quality,
        effort: 4,
        smartSubsample: true,
      })

    const out = await pipeline.toBuffer({ resolveWithObject: true })
    return {
      buffer: out.data,
      mime: 'image/webp',
      width: out.info.width,
      height: out.info.height,
      bytesIn: buffer.length,
      bytesOut: out.data.length,
      sourceWidth: meta.width,
      sourceHeight: meta.height,
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(415, 'IMAGE_OPTIMIZE_FAILED', 'Image could not be optimized for upload')
  }
}

export { PRESETS as IMAGE_OPTIMIZE_PRESETS }
