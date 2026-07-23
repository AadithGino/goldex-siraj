import * as service from '../../services/admin.service.js'
import { ok } from '../../utils/apiResponse.js'
import { serialize } from '../../utils/serialize.js'

export async function coupons(req, res) {
  const result = await service.listCoupons(req.validated?.query ?? req.query)
  await ok(res, serialize(result.items), 200, {
    page: result.page, limit: result.limit, total: result.total, pages: result.pages,
  })
}
export async function couponCreate(req, res) {
  await ok(res, serialize(await service.createCoupon(req.validated.body)), 201)
}
export async function couponUpdate(req, res) {
  await ok(res, serialize(await service.updateCoupon(req.validated?.params?.id ?? req.params.id, req.validated.body)))
}
export async function couponDelete(req, res) {
  await ok(res, serialize(await service.deleteCoupon(req.validated?.params?.id ?? req.params.id)))
}
export async function couponUsageSummary(_req, res) {
  await ok(res, serialize(await service.couponUsageSummary()))
}
export async function couponUsage(req, res) {
  const result = await service.couponUsage(
    req.validated?.params?.id ?? req.params.id,
    req.validated?.query ?? req.query,
  )
  await ok(res, serialize(result.items), 200, {
    page: result.page, limit: result.limit, total: result.total, pages: result.pages,
  })
}
export async function lowStock(req, res) {
  const result = await service.lowStock(req.validated?.query ?? req.query)
  await ok(res, serialize(result.items), 200, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    pages: result.pages,
  })
}
export async function variants(req, res) {
  const result = await service.variants(req.validated?.query ?? req.query)
  await ok(res, serialize(result.items), 200, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    pages: result.pages,
  })
}
export async function adjust(req, res) {
  const body = req.validated.body
  await ok(res, serialize(await service.adjustStock(
    req.validated?.params?.id ?? req.params.id,
    body.delta,
    body.reason,
    body.note,
    req.auth.sub,
    { idempotencyKey: body.idempotency_key || body.idempotencyKey },
  )))
}
export async function setStock(req, res) {
  const body = req.validated.body
  await ok(res, serialize(await service.setStock(req.validated?.params?.id ?? req.params.id, {
    qty: body.qty,
    expectedBefore: body.expected_before ?? body.expectedBefore,
    reason: body.reason,
    note: body.note,
    idempotencyKey: body.idempotency_key || body.idempotencyKey,
  }, req.auth.sub)))
}
export async function ledger(req, res) {
  const result = await service.stockLedger(req.validated?.query ?? req.query)
  await ok(res, serialize(result.items), 200, {
    total: result.total, page: result.page, limit: result.limit, pages: result.pages,
  })
}
export async function payments(req, res) {
  const result = await service.paymentEvents(req.validated?.query ?? req.query)
  await ok(res, serialize(result.items), 200, {
    page: result.page, limit: result.limit, total: result.total, pages: result.pages,
  })
}
export async function audit(req, res) {
  const result = await service.auditLog(req.validated?.query ?? req.query)
  await ok(res, serialize(result.items), 200, {
    page: result.page, limit: result.limit, total: result.total, pages: result.pages,
  })
}
