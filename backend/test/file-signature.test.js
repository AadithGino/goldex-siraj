import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { assertSafeUpload, detectMimeFromBuffer } from '../src/utils/fileSignature.js'

const png1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

async function buildValidPdf(pages = 1) {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i += 1) doc.addPage()
  return Buffer.from(await doc.save())
}

function buildOpenActionJsPdf() {
  return Buffer.from(`%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R /OpenAction << /S /JavaScript /JS (app.alert\\(1\\);) >> >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000115 00000 n 
0000000172 00000 n 
trailer<< /Size 4 /Root 1 0 R >>
startxref
240
%%EOF
`)
}

function buildAnnotationAJsPdf() {
  return Buffer.from(`%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Annots [4 0 R] >>endobj
4 0 obj<< /Type /Annot /Subtype /Link /Rect [0 0 50 50] /A << /S /JavaScript /JS (app.alert\\(1\\);) >> >>endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer<< /Size 5 /Root 1 0 R >>
startxref
310
%%EOF
`)
}

function buildAaActionPdf() {
  return Buffer.from(`%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R /AA << /O << /S /JavaScript /JS (1) >> >> >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000098 00000 n 
0000000155 00000 n 
trailer<< /Size 4 /Root 1 0 R >>
startxref
223
%%EOF
`)
}

function buildEmbeddedFilePdf() {
  return Buffer.from(`%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [(evil.txt) 4 0 R] >> >> >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>endobj
4 0 obj<< /Type /Filespec /F (evil.txt) /EF << /F 5 0 R >> >>endobj
5 0 obj<< /Type /EmbeddedFile /Length 3 >>stream
abc
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000118 00000 n 
0000000175 00000 n 
0000000246 00000 n 
0000000318 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
390
%%EOF
`)
}

function buildXfaPdf() {
  return Buffer.from(`%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R /AcroForm << /XFA [(xdp:xdp) 4 0 R] >> >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>endobj
4 0 obj<< /Length 8 >>stream
<xdp></xdp>
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000100 00000 n 
0000000157 00000 n 
0000000228 00000 n 
trailer<< /Size 5 /Root 1 0 R >>
startxref
280
%%EOF
`)
}

describe('file signature validation', () => {
  it('detects PNG magic bytes', () => {
    expect(detectMimeFromBuffer(png1x1)).toBe('image/png')
  })

  it('rejects spoofed executable content', async () => {
    const fake = Buffer.from('MZ\x90\x00not-an-image')
    expect(detectMimeFromBuffer(fake)).toBeNull()
    await expect(assertSafeUpload('return', { buffer: fake, mimetype: 'image/png', size: fake.length }))
      .rejects.toThrow(/signature|not allowed/i)
  })

  it('rejects MIME mismatch against magic bytes', async () => {
    await expect(assertSafeUpload('return', { buffer: png1x1, mimetype: 'image/jpeg', size: png1x1.length }))
      .rejects.toMatchObject({ code: 'MIME_MISMATCH' })
  })

  it('decodes a valid PNG via sharp', async () => {
    await expect(assertSafeUpload('return', { buffer: png1x1, mimetype: 'image/png', size: png1x1.length }))
      .resolves.toBe('image/png')
  })

  it('rejects truncated PNG payloads', async () => {
    const truncated = png1x1.subarray(0, 20)
    await expect(assertSafeUpload('product', { buffer: truncated, mimetype: 'image/png', size: truncated.length }))
      .rejects.toMatchObject({ code: 'INVALID_IMAGE' })
  })

  it('accepts a real small PDF generated with pdf-lib', async () => {
    const pdf = await buildValidPdf()
    await expect(assertSafeUpload('certificate', { buffer: pdf, mimetype: 'application/pdf', size: pdf.length }))
      .resolves.toBe('application/pdf')
  })

  it('rejects a fake %PDF header that is not a real PDF', async () => {
    const fake = Buffer.from('%PDF-1.4\n%âãÏÓ\nfake content\n%%EOF\n')
    await expect(assertSafeUpload('certificate', { buffer: fake, mimetype: 'application/pdf', size: fake.length }))
      .rejects.toMatchObject({ code: 'INVALID_PDF' })
  })

  it('rejects truncated PDF payloads', async () => {
    const pdf = await buildValidPdf()
    const truncated = pdf.subarray(0, Math.min(40, pdf.length - 1))
    await expect(assertSafeUpload('certificate', { buffer: truncated, mimetype: 'application/pdf', size: truncated.length }))
      .rejects.toMatchObject({ code: expect.stringMatching(/INVALID_PDF|PDF_TIMEOUT/) })
  })

  it('rejects PDFs with more than allowed pages', async () => {
    const pdf = await buildValidPdf(51)
    await expect(assertSafeUpload('certificate', { buffer: pdf, mimetype: 'application/pdf', size: pdf.length }))
      .rejects.toMatchObject({ code: 'PDF_TOO_LARGE' })
  })

  it('rejects catalog OpenAction JavaScript', async () => {
    const pdf = buildOpenActionJsPdf()
    await expect(assertSafeUpload('certificate', { buffer: pdf, mimetype: 'application/pdf', size: pdf.length }))
      .rejects.toMatchObject({ code: 'UNSAFE_PDF' })
  })

  it('rejects annotation /A JavaScript', async () => {
    const pdf = buildAnnotationAJsPdf()
    await expect(assertSafeUpload('certificate', { buffer: pdf, mimetype: 'application/pdf', size: pdf.length }))
      .rejects.toMatchObject({ code: 'UNSAFE_PDF' })
  })

  it('rejects /AA action', async () => {
    const pdf = buildAaActionPdf()
    await expect(assertSafeUpload('certificate', { buffer: pdf, mimetype: 'application/pdf', size: pdf.length }))
      .rejects.toMatchObject({ code: 'UNSAFE_PDF' })
  })

  it('rejects embedded attachments', async () => {
    const pdf = buildEmbeddedFilePdf()
    await expect(assertSafeUpload('certificate', { buffer: pdf, mimetype: 'application/pdf', size: pdf.length }))
      .rejects.toMatchObject({ code: 'UNSAFE_PDF' })
  })

  it('rejects XFA forms', async () => {
    const pdf = buildXfaPdf()
    await expect(assertSafeUpload('certificate', { buffer: pdf, mimetype: 'application/pdf', size: pdf.length }))
      .rejects.toMatchObject({ code: 'UNSAFE_PDF' })
  })

  it('rejects PDF declared as image MIME', async () => {
    const pdf = await buildValidPdf()
    await expect(assertSafeUpload('certificate', { buffer: pdf, mimetype: 'image/png', size: pdf.length }))
      .rejects.toMatchObject({ code: 'MIME_MISMATCH' })
  })

  it('rejects oversized PDF byte payloads', async () => {
    const header = Buffer.from('%PDF-1.4\n')
    const huge = Buffer.concat([header, Buffer.alloc(10 * 1024 * 1024)])
    await expect(assertSafeUpload('certificate', { buffer: huge, mimetype: 'application/pdf', size: huge.length }))
      .rejects.toMatchObject({ code: 'PDF_TOO_LARGE' })
  })
})
