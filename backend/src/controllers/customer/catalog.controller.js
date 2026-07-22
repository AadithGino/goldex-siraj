import * as catalogService from '../../services/catalog.service.js'
import { ok } from '../../utils/apiResponse.js'
import { serialize } from '../../utils/serialize.js'

export async function list(req, res) {
  const resource = req.validated?.params?.resource ?? req.params.resource
  const query = req.validated?.query ?? req.query
  const result = await catalogService.list(resource, query)
  ok(res, serialize(result.items), 200, {
    total: result.total,
    page: result.page,
    limit: result.limit,
    pages: result.pages,
  })
}
export async function getOne(req, res) {
  const resource = req.validated?.params?.resource ?? req.params.resource
  const id = req.validated?.params?.id ?? req.params.id
  ok(res, serialize(await catalogService.getOne(resource, id)))
}
export async function bootstrap(_req, res) {
  ok(res, serialize(await catalogService.publicBootstrap()))
}
