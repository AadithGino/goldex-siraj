import * as orderService from '../../services/order.service.js'
import { ok } from '../../utils/apiResponse.js'
import { serialize } from '../../utils/serialize.js'

export async function list(req, res) {
  const result = await orderService.listAdminOrders(req.validated?.query ?? req.query)
  await ok(res, serialize(result.items), 200, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    pages: result.pages,
  })
}
export async function get(req, res) {
  await ok(res, serialize(await orderService.getAdminOrder(req.validated?.params?.id ?? req.params.id)))
}
export async function status(req, res) {
  await ok(res, serialize(await orderService.updateStatus(
    req.validated?.params?.id ?? req.params.id,
    req.validated.body.status,
    req.validated.body.note,
    req.auth.sub,
  )))
}
export async function handover(req, res) {
  await ok(res, serialize(await orderService.finalizeCodHandover(
    req.validated?.params?.id ?? req.params.id,
    req.auth.sub,
    req.validated.body,
  )))
}
export async function manualPayment(req, res) {
  await ok(res, serialize(await orderService.markManualPaid(
    req.validated?.params?.id ?? req.params.id,
    req.auth.sub,
    req.validated.body,
  )))
}
