import * as catalogService from '../../services/catalog.service.js'
import { ok } from '../../utils/apiResponse.js'
import { serialize } from '../../utils/serialize.js'

export async function list(req, res) {
  const query = req.validated?.query ?? req.query
  const resource = req.validated?.params?.resource ?? req.params.resource
  const result = await catalogService.list(resource, query, true)
  await ok(res, serialize(result.items), 200, {
    total: result.total,
    page: result.page,
    limit: result.limit,
    pages: result.pages,
  })
}
export async function getOne(req, res) {
  const resource = req.validated?.params?.resource ?? req.params.resource
  const id = req.validated?.params?.id ?? req.params.id
  await ok(res, serialize(await catalogService.getOne(resource, id, true)))
}
export async function create(req, res) {
  const resource = req.validated?.params?.resource ?? req.params.resource
  await ok(res, serialize(await catalogService.create(resource, req.validated.body)), 201)
}
export async function update(req, res) {
  const resource = req.validated?.params?.resource ?? req.params.resource
  const id = req.validated?.params?.id ?? req.params.id
  await ok(res, serialize(await catalogService.update(resource, id, req.validated.body)))
}
export async function remove(req, res) {
  const resource = req.validated?.params?.resource ?? req.params.resource
  const id = req.validated?.params?.id ?? req.params.id
  await catalogService.remove(resource, id)
  res.status(204).end()
}
export async function updateSettings(req, res) {
  const kind = req.validated?.params?.kind ?? req.params.kind
  await ok(res, serialize(await catalogService.updateSettings(kind, req.validated.body)))
}
export async function createVariantComplete(req, res) {
  await ok(res, serialize(await catalogService.createVariantComplete(req.validated.body, req.auth.sub)), 201)
}
export async function updateVariantComplete(req, res) {
  const id = req.validated?.params?.id ?? req.params.id
  await ok(res, serialize(await catalogService.updateVariantComplete(id, req.validated.body, req.auth.sub)))
}
export async function setPrimaryImage(req, res) {
  const id = req.validated?.params?.id ?? req.params.id
  await ok(res, serialize(await catalogService.setPrimaryImage(id)))
}
