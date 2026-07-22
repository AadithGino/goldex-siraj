import { describe, expect, it } from 'vitest'
import { CmsPayloadError, toCmsPayload } from './cmsPayload'

describe('toCmsPayload', () => {
  it('emits canonical snake_case with normalized slug and sanitized content', () => {
    const payload = toCmsPayload({
      slug: ' Shipping Policy ',
      title: 'Shipping Policy',
      title_ar: 'الشحن',
      content: '<p><strong>Hello</strong></p>',
      content_ar: '<p>نص</p>',
      is_published: true,
    })
    expect(payload).toEqual({
      slug: 'shipping-policy',
      title: 'Shipping Policy',
      title_ar: 'الشحن',
      content: '<p><strong>Hello</strong></p>',
      content_ar: '<p>نص</p>',
      is_published: true,
    })
  })

  it('requires slug, title, content', () => {
    expect(() => toCmsPayload({
      slug: '', title: 'T', content: '<p>x</p>', is_published: false,
    })).toThrow(CmsPayloadError)
    expect(() => toCmsPayload({
      slug: 'x', title: '  ', content: '<p>x</p>', is_published: false,
    })).toThrow(/title/)
    expect(() => toCmsPayload({
      slug: 'x', title: 'T', content: '  ', is_published: false,
    })).toThrow(/content/)
  })

  it('strips XSS from content while keeping allowed markup', () => {
    const payload = toCmsPayload({
      slug: 'safe',
      title: 'Safe',
      content: '<script>alert(1)</script><p onclick="x">ok</p><a href="javascript:alert(1)">x</a>',
      is_published: true,
    })
    expect(payload.content).not.toMatch(/<script/i)
    expect(payload.content).not.toMatch(/onclick/i)
    expect(payload.content).not.toMatch(/javascript:/i)
    expect(payload.content).toContain('ok')

    expect(toCmsPayload({
      slug: 'hello',
      title: 'Hello',
      content: '<p><strong>Hello</strong></p>',
      is_published: false,
    }).content).toBe('<p><strong>Hello</strong></p>')
  })

  it('partial update requires at least one field', () => {
    expect(() => toCmsPayload({}, { partial: true })).toThrow(/At least one field/)
    expect(toCmsPayload({ is_published: true }, { partial: true })).toEqual({ is_published: true })
  })
})
