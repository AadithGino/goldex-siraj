import { upload } from '../../services/storage.service.js'
import { ok } from '../../utils/apiResponse.js'
export async function uploadFile(req, res) { await ok(res, await upload(req.params.kind, req.file), 201) }
