import * as service from '../../services/scheme.service.js'
import { ok } from '../../utils/apiResponse.js'
import { serialize } from '../../utils/serialize.js'

export async function list(req, res) {
  const result = await service.listSchemes(true, req.validated?.query ?? req.query)
  ok(res, serialize(result.items), 200, {
    page: result.page, limit: result.limit, total: result.total, pages: result.pages,
  })
}

export async function create(req, res) {
  ok(res, serialize(await service.createScheme(req.validated.body)), 201)
}

export async function update(req, res) {
  ok(res, serialize(await service.updateScheme(req.validated.params.id, req.validated.body)))
}

export async function enrollments(req, res) {
  const result = await service.listEnrollments(req.validated?.query ?? req.query)
  ok(res, result.items, 200, {
    page: result.page, limit: result.limit, total: result.total, pages: result.pages,
  })
}

export async function enrollmentDetail(req, res) {
  ok(res, await service.getEnrollmentForAdmin(req.validated.params.id))
}

export async function updateEnrollment(req, res) {
  ok(res, serialize(await service.updateEnrollment(
    req.validated.params.id,
    req.validated.body,
    req.auth.sub,
  )))
}

export async function completeEnrollment(req, res) {
  const body = req.validated.body || {}
  ok(res, serialize(await service.completeEnrollment(
    req.validated.params.id,
    req.auth.sub,
    { note: body.note || body.resolution_note },
  )))
}

export async function recordPayment(req, res) {
  ok(res, await service.recordInstallment(
    req.validated.params.id,
    req.validated.params.installmentId,
    req.validated.body,
    req.auth.sub,
  ))
}

export async function recordPaymentById(req, res) {
  ok(res, await service.recordInstallmentById(
    req.validated.params.installmentId,
    req.validated.body,
    req.auth.sub,
  ))
}
