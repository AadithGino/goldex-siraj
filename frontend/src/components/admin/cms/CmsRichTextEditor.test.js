import { describe, expect, it } from 'vitest'
import { normalizeEditorHtml } from '@/components/admin/cms/CmsRichTextEditor'

describe('normalizeEditorHtml', () => {
  it('treats empty editor output as blank string', () => {
    expect(normalizeEditorHtml('')).toBe('')
    expect(normalizeEditorHtml('<p></p>')).toBe('')
    expect(normalizeEditorHtml('<p><br></p>')).toBe('')
  })

  it('keeps non-empty HTML', () => {
    expect(normalizeEditorHtml('<p><strong>Hello</strong></p>')).toBe('<p><strong>Hello</strong></p>')
  })
})
