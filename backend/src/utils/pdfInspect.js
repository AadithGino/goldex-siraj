import { PDFDocument, PDFDict, PDFName, PDFArray, PDFRef } from 'pdf-lib'
import { AppError } from './AppError.js'

export const MAX_PDF_PAGES = 50
export const MAX_PDF_BYTES = 10 * 1024 * 1024
export const MAX_PDF_OBJECTS = 5_000
export const MAX_PDF_DEPTH = 64

const UNSAFE_PDF_KEYS = new Set([
  'JS',
  'JavaScript',
  'OpenAction',
  'AA',
  'A',
  'Launch',
  'EmbeddedFile',
  'EmbeddedFiles',
  'RichMedia',
  'XFA',
  'SubmitForm',
  'ImportData',
  'GoToR',
])

function asDict(node) {
  return node instanceof PDFDict ? node : null
}

function walkPdfObject(context, node, state, depth) {
  if (state.unsafe) return
  if (depth > MAX_PDF_DEPTH || state.visited >= MAX_PDF_OBJECTS) {
    state.malformed = true
    return
  }
  state.visited += 1

  let current = node
  if (current instanceof PDFRef) {
    const key = String(current.tag || current.objectNumber)
    if (state.seenRefs.has(key)) return
    state.seenRefs.add(key)
    try {
      current = context.lookup(current)
    } catch {
      state.malformed = true
      return
    }
  }

  const dict = asDict(current)
  if (dict) {
    for (const key of UNSAFE_PDF_KEYS) {
      if (dict.has(PDFName.of(key))) {
        state.unsafe = true
        return
      }
    }
    for (const value of dict.values()) {
      walkPdfObject(context, value, state, depth + 1)
      if (state.unsafe || state.malformed) return
    }
    return
  }

  if (current instanceof PDFArray) {
    const arr = typeof current.asArray === 'function' ? current.asArray() : []
    for (const value of arr) {
      walkPdfObject(context, value, state, depth + 1)
      if (state.unsafe || state.malformed) return
    }
  }
}

export function inspectPdfSafety(doc) {
  const state = {
    unsafe: false,
    malformed: false,
    visited: 0,
    seenRefs: new Set(),
  }

  if (doc.isEncrypted) return { unsafe: true, reason: 'encrypt' }
  const encrypt = doc.context?.trailerInfo?.Encrypt
  if (encrypt) return { unsafe: true, reason: 'encrypt' }

  const pageCount = doc.getPageCount()
  if (pageCount < 1) return { malformed: true }
  if (pageCount > MAX_PDF_PAGES) return { tooLarge: true, pageCount }

  walkPdfObject(doc.context, doc.catalog, state, 0)
  if (state.unsafe) return { unsafe: true, reason: 'active_content' }
  if (state.malformed) return { malformed: true }

  for (let i = 0; i < pageCount; i += 1) {
    const page = doc.getPage(i)
    const node = page.node
    for (const key of UNSAFE_PDF_KEYS) {
      if (node.has(PDFName.of(key))) return { unsafe: true, reason: 'active_content' }
    }
    const annots = node.lookup(PDFName.of('Annots'))
    if (!annots) continue
    const list = Array.isArray(annots)
      ? annots
      : (typeof annots.asArray === 'function' ? annots.asArray() : [])
    for (const annotRef of list) {
      let annot = annotRef
      try {
        if (annot instanceof PDFRef) annot = doc.context.lookup(annot)
      } catch {
        return { malformed: true }
      }
      if (!(annot instanceof PDFDict)) continue
      for (const key of UNSAFE_PDF_KEYS) {
        if (annot.has(PDFName.of(key))) return { unsafe: true, reason: 'active_content' }
      }
      const action = annot.lookup(PDFName.of('A'))
      if (action) {
        walkPdfObject(doc.context, action, state, 0)
        if (state.unsafe) return { unsafe: true, reason: 'active_content' }
      }
    }
  }

  return { ok: true }
}

export async function parseAndInspectPdf(buffer) {
  let doc
  try {
    doc = await PDFDocument.load(buffer, {
      ignoreEncryption: false,
      updateMetadata: false,
      throwOnInvalidObject: true,
    })
  } catch (error) {
    const message = String(error?.message || error)
    if (/encrypt|password/i.test(message)) {
      throw new AppError(415, 'UNSAFE_PDF', 'Encrypted PDFs are not allowed')
    }
    throw new AppError(415, 'INVALID_PDF', 'PDF could not be parsed')
  }

  const result = inspectPdfSafety(doc)
  if (result.reason === 'encrypt') {
    throw new AppError(415, 'UNSAFE_PDF', 'Encrypted PDFs are not allowed')
  }
  if (result.tooLarge) {
    throw new AppError(415, 'PDF_TOO_LARGE', `PDF exceeds ${MAX_PDF_PAGES} pages`)
  }
  if (result.malformed) {
    throw new AppError(415, 'INVALID_PDF', 'PDF object graph is malformed')
  }
  if (result.unsafe) {
    throw new AppError(415, 'UNSAFE_PDF', 'PDF contains unsupported active or embedded content')
  }
  return true
}
