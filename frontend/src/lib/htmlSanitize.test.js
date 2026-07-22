import { describe, expect, it } from 'vitest'
import { sanitizeCmsHtml } from './htmlSanitize'

describe('sanitizeCmsHtml', () => {
  it('strips script, event handlers, and javascript: URLs', () => {
    const dirty = '<script>alert(1)</script><p onclick="x" onerror="y">ok</p><img onerror="z" src="x"><a href="javascript:alert(1)">x</a>'
    const clean = sanitizeCmsHtml(dirty)
    expect(clean).not.toMatch(/<script/i)
    expect(clean).not.toMatch(/onclick/i)
    expect(clean).not.toMatch(/onerror/i)
    expect(clean).not.toMatch(/javascript:/i)
    expect(clean).not.toMatch(/<img/i)
    expect(clean).toContain('ok')
  })

  it('keeps allowed strong/p markup', () => {
    expect(sanitizeCmsHtml('<p><strong>Hello</strong></p>')).toBe('<p><strong>Hello</strong></p>')
  })

  it('returns empty string for non-string input', () => {
    expect(sanitizeCmsHtml(null)).toBe('')
    expect(sanitizeCmsHtml(undefined)).toBe('')
    expect(sanitizeCmsHtml(12)).toBe('')
  })
})
