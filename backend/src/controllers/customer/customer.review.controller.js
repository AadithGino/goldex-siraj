import * as service from '../../services/review.service.js'
import { ok } from '../../utils/apiResponse.js'
import { serialize } from '../../utils/serialize.js'

export async function list(req, res) { await ok(res, serialize(await service.listPublic(req.params.productId))) }
export async function submit(req, res) { await ok(res, serialize(await service.submit(req.auth.sub, req.validated?.body || req.body)), 201) }
export async function mine(req, res) { await ok(res, serialize(await service.getMine(req.auth.sub, req.params.productId))) }
