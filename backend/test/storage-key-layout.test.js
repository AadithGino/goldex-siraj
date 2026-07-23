import { describe, expect, it } from 'vitest'
import { buildObjectKey, resolveUploadKind } from '../src/services/storage.service.js'
import { config } from '../src/config/env.js'

describe('storage object key layout', () => {
  it('maps kinds to public vs private folders', () => {
    expect(resolveUploadKind('product')).toEqual({ visibility: 'public', folder: 'product-images' })
    expect(resolveUploadKind('banner')).toEqual({ visibility: 'public', folder: 'banner-images' })
    expect(resolveUploadKind('video')).toEqual({ visibility: 'public', folder: 'product-videos' })
    expect(resolveUploadKind('certificate')).toEqual({ visibility: 'private', folder: 'product-certificates' })
    expect(resolveUploadKind('return')).toEqual({ visibility: 'private', folder: 'return-proof-images' })
  })

  it('builds jewellers/{tenant}/public|private/{folder}/... keys', () => {
    const now = new Date('2026-07-23T10:00:00.000Z')
    const key = buildObjectKey('product', 'image/jpeg', { now })
    const prefix = config.storage.s3.prefix || 'jewellers'
    const tenant = config.storage.s3.jewelleryFolder || config.jewellery.folder || 'goldex1-jewellery'
    expect(key).toMatch(new RegExp(`^${prefix}/${tenant}/public/product-images/2026-07-23/[0-9a-f-]+\\.jpg$`))
  })

  it('places certificates under private/', () => {
    const now = new Date('2026-07-23T10:00:00.000Z')
    const key = buildObjectKey('certificate', 'application/pdf', { now })
    expect(key).toContain('/private/product-certificates/')
    expect(key).not.toContain('/public/')
  })
})
