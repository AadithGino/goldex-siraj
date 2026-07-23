import * as service from '../../services/admin.service.js'
import { ok } from '../../utils/apiResponse.js'
import { serialize } from '../../utils/serialize.js'
import * as walletService from '../../services/wallet.service.js'

export async function customers(req, res) {
  const result = await service.listCustomers(req.validated?.query ?? req.query)
  await ok(res, serialize(result.items), 200, {
    page: result.page, limit: result.limit, total: result.total, pages: result.pages,
  })
}
export async function customer(req, res) {
  await ok(res, serialize(await service.getCustomer(req.validated?.params?.id ?? req.params.id)))
}
export async function customerUpdate(req, res) {
  await ok(res, serialize(await service.updateCustomer(req.validated?.params?.id ?? req.params.id, req.validated.body)))
}
export async function staff(_req, res) {
  await ok(res, serialize(await service.listStaff()))
}
export async function staffCreate(req, res) {
  await ok(res, serialize(await service.createStaff(req.validated.body, req.auth.sub)), 201)
}
export async function staffUpdate(req, res) {
  await ok(res, serialize(await service.updateStaff(req.validated?.params?.id ?? req.params.id, req.validated.body, req.auth.sub)))
}
export async function staffDelete(req, res) {
  await service.deleteStaff(req.params.id, req.auth.sub)
  res.status(204).end()
}
export async function customerWallet(req, res) {
  const query = req.validated?.query ?? req.query
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100)
  await ok(res, serialize(await walletService.transactions(req.validated?.params?.id ?? req.params.id, limit)))
}
