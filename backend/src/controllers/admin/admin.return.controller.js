import * as service from '../../services/return.service.js'
import { ok } from '../../utils/apiResponse.js'
import { serialize } from '../../utils/serialize.js'
export async function list(req, res) { ok(res, serialize(await service.listAdminReturns(req.query))) }
export async function resolve(req, res) { ok(res, serialize(await service.resolveReturn(req.params.id, req.body, req.auth.sub))) }
