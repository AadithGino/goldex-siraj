import * as service from '../../services/custom-request.service.js'
import { ok } from '../../utils/apiResponse.js'
import { serialize } from '../../utils/serialize.js'

export async function list(req, res) {
  await ok(res, serialize(await service.listCustomerRequests(req.auth.sub)))
}

export async function getOne(req, res) {
  const id = req.validated?.params?.id ?? req.params.id
  await ok(res, serialize(await service.getCustomerRequest(req.auth.sub, id)))
}

export async function create(req, res) {
  const body = req.validated?.body || req.body
  await ok(res, serialize(await service.createRequest(req.auth.sub, body)), 201)
}

export async function cancel(req, res) {
  const id = req.validated?.params?.id ?? req.params.id
  await ok(res, serialize(await service.cancelRequest(req.auth.sub, id)))
}

export async function accept(req, res) {
  const id = req.validated?.params?.id ?? req.params.id
  await ok(res, serialize(await service.acceptQuote(req.auth.sub, id)))
}

export async function decline(req, res) {
  const id = req.validated?.params?.id ?? req.params.id
  const body = req.validated?.body || req.body || {}
  await ok(res, serialize(await service.declineQuote(req.auth.sub, id, body.reason)))
}
