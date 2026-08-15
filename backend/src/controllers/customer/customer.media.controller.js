import { uploadReturnProof as storeReturnProof } from '../../services/upload.service.js'
import { createPresignedUpload, upload } from '../../services/storage.service.js'
import { ok } from '../../utils/apiResponse.js'
import { serialize } from '../../utils/serialize.js'
import { AppError } from '../../utils/AppError.js'

export async function uploadReturnProof(req, res) {
  await ok(res, serialize(await storeReturnProof(req.auth.sub, req.file)), 201)
}

export async function uploadSchemeIdProof(req, res) {
  const stored = await upload('scheme-id-proof', req.file)
  await ok(res, serialize({
    key: stored.key,
    url: stored.url,
    storage_url: stored.storage_url || stored.key,
    mime: stored.mime,
  }), 201)
}

export async function uploadCustomJewellery(req, res) {
  const stored = await upload('custom-jewellery', req.file)
  await ok(res, serialize({
    key: stored.key,
    url: stored.url,
    storage_url: stored.storage_url || stored.key,
    mime: stored.mime,
  }), 201)
}

async function uploadPrivateKind(req, res, kind) {
  const stored = await upload(kind, req.file)
  await ok(res, serialize({
    key: stored.key,
    url: stored.url,
    storage_url: stored.storage_url || stored.key,
    mime: stored.mime,
  }), 201)
}

export async function uploadSellJewellery(req, res) {
  await uploadPrivateKind(req, res, 'sell-jewellery')
}

export async function uploadSellInvoice(req, res) {
  await uploadPrivateKind(req, res, 'sell-invoice')
}

/** Issue AWS S3 presigned PUT (or local proxy fallback) for customer private media. */
export async function presignCustomerMedia(req, res) {
  const body = req.validated?.body ?? req.body ?? {}
  const kind = String(body.kind || '').trim()
  if (!kind) throw new AppError(422, 'KIND_REQUIRED', 'kind is required')
  const ticket = await createPresignedUpload(kind, {
    contentType: body.content_type ?? body.contentType,
    contentLength: body.content_length ?? body.contentLength,
  })
  await ok(res, serialize(ticket), 200)
}
