import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { optimizeUploadImage } from '../src/utils/imageOptimize.js'

describe('optimizeUploadImage', () => {
  it('converts large PNG product shots to smaller WebP', async () => {
    const png = await sharp({
      create: { width: 2400, height: 1800, channels: 3, background: { r: 200, g: 180, b: 120 } },
    }).png().toBuffer()

    const out = await optimizeUploadImage('product', png, 'image/png')
    expect(out.mime).toBe('image/webp')
    expect(out.width).toBeLessThanOrEqual(1600)
    expect(out.height).toBeLessThanOrEqual(1600)
    expect(out.bytesOut).toBeLessThan(out.bytesIn)
  })

  it('optimizes banner images to WebP within banner max edge', async () => {
    const png = await sharp({
      create: { width: 3000, height: 1200, channels: 3, background: { r: 40, g: 60, b: 100 } },
    }).png().toBuffer()

    const out = await optimizeUploadImage('banner', png, 'image/png')
    expect(out.mime).toBe('image/webp')
    expect(out.width).toBeLessThanOrEqual(1920)
    expect(out.bytesOut).toBeLessThan(out.bytesIn)
  })

  it('optimizes category tiles more aggressively', async () => {
    const png = await sharp({
      create: { width: 1600, height: 1600, channels: 3, background: { r: 180, g: 160, b: 100 } },
    }).png().toBuffer()

    const out = await optimizeUploadImage('category', png, 'image/png')
    expect(out.mime).toBe('image/webp')
    expect(out.width).toBeLessThanOrEqual(800)
    expect(out.height).toBeLessThanOrEqual(800)
    expect(out.bytesOut).toBeLessThan(out.bytesIn)
  })

  it('leaves PDFs untouched', async () => {
    const pdf = Buffer.from('%PDF-1.4 fake')
    const out = await optimizeUploadImage('certificate', pdf, 'application/pdf')
    expect(out.mime).toBe('application/pdf')
    expect(out.buffer).toBe(pdf)
  })
})
