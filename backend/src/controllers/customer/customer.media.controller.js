import { uploadReturnProof as storeReturnProof } from '../../services/upload.service.js'
import { upload } from '../../services/storage.service.js'
import { ok } from '../../utils/apiResponse.js'
import { serialize } from '../../utils/serialize.js'

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
