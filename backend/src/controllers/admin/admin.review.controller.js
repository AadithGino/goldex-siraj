import * as service from '../../services/review.service.js'
import { ok } from '../../utils/apiResponse.js'
import { serialize } from '../../utils/serialize.js'

export async function list(req, res) { await ok(res, serialize(await service.listAdmin(req.query))) }
export async function moderate(req, res) {
  const body = req.validated?.body || req.body
  await ok(res, serialize(await service.moderate(req.params.id, body.status)))
}
