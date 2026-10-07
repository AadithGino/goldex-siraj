import { describe, expect, it } from 'vitest'
import {
  buildWhatsAppChatUrl,
  buildWhatsAppEnquiryMessage,
  pickProductImageUrl,
} from './whatsappEnquiry'

const t = (key) =>
  ({
    'product:whatsappEnquiry.intro': 'Hello enquiry',
    'product:whatsappEnquiry.product': 'Product',
    'product:whatsappEnquiry.variant': 'Variant',
    'product:whatsappEnquiry.sku': 'SKU',
    'product:whatsappEnquiry.price': 'Price',
    'product:whatsappEnquiry.image': 'Image',
    'product:whatsappEnquiry.link': 'Link',
  })[key] ?? key

describe('whatsappEnquiry', () => {
  it('pickProductImageUrl prefers variant and primary', () => {
    const url = pickProductImageUrl(
      [
        { url: 'https://cdn/a.jpg', variant_id: 'v1', is_primary: 0 },
        { url: 'https://cdn/b.jpg', variant_id: 'v2', is_primary: 1 },
      ],
      'v2',
    )
    expect(url).toBe('https://cdn/b.jpg')
  })

  it('builds message with product, variant, sku, image, link', () => {
    const message = buildWhatsAppEnquiryMessage({
      t,
      productName: 'Gold Ring',
      variant: { variant_label: 'Size 16', sku: 'GR-16', weight_grams: 4.2 },
      imageUrl: 'https://cdn/ring.jpg',
      productUrl: 'https://shop.example/p/ring',
      priceLabel: 'AED 1,200',
    })
    expect(message).toContain('Gold Ring')
    expect(message).toContain('Size 16')
    expect(message).toContain('GR-16')
    expect(message).toContain('https://cdn/ring.jpg')
    expect(message).toContain('https://shop.example/p/ring')
    expect(message).toContain('AED 1,200')
  })

  it('buildWhatsAppChatUrl encodes text', () => {
    const url = buildWhatsAppChatUrl('971565084747', 'Hello & test')
    expect(url).toBe('https://wa.me/971565084747?text=Hello%20%26%20test')
  })
})
