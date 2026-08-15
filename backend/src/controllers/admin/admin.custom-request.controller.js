import * as service from '../../services/custom-request.service.js'
import { ok } from '../../utils/apiResponse.js'
import { serialize } from '../../utils/serialize.js'

export async function list(req, res) {
  const query = req.validated?.query ?? req.query
  await ok(res, serialize(await service.listAdminRequests(query)))
}

export async function getOne(req, res) {
  const id = req.validated?.params?.id ?? req.params.id
  await ok(res, serialize(await service.getAdminRequest(id)))
}

export async function quote(req, res) {
  const id = req.validated?.params?.id ?? req.params.id
  const body = req.validated?.body || req.body
  await ok(res, serialize(await service.quoteRequest(id, body, req.auth.sub)))
}

export async function decline(req, res) {
  const id = req.validated?.params?.id ?? req.params.id
  const body = req.validated?.body || req.body || {}
  await ok(res, serialize(await service.declineRequest(id, body, req.auth.sub)))
}

export async function complete(req, res) {
  const id = req.validated?.params?.id ?? req.params.id
  const body = req.validated?.body || req.body || {}
  await ok(res, serialize(await service.completeRequest(id, body, req.auth.sub)))
}
