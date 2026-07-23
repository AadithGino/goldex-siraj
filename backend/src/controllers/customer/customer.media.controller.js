import { uploadReturnProof as storeReturnProof } from '../../services/upload.service.js'
import { ok } from '../../utils/apiResponse.js'
import { serialize } from '../../utils/serialize.js'

export async function uploadReturnProof(req, res) {
  await ok(res, serialize(await storeReturnProof(req.auth.sub, req.file)), 201)
}
