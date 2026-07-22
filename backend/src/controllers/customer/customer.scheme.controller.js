import * as service from '../../services/scheme.service.js'
import { ok } from '../../utils/apiResponse.js'
import { serialize } from '../../utils/serialize.js'

export async function list(_req, res) {
  const result = await service.listSchemes(false, { limit: 100 })
  ok(res, serialize(result.items), 200, {
    page: result.page, limit: result.limit, total: result.total, pages: result.pages,
  })
}

export async function enrollments(req, res) {
  const result = await service.listCustomerEnrollments(req.auth.sub, req.validated?.query ?? req.query)
  ok(res, result.items, 200, {
    page: result.page, limit: result.limit, total: result.total, pages: result.pages,
  })
}

export async function enrollmentDetail(req, res) {
  ok(res, await service.getEnrollmentForCustomer(req.auth.sub, req.validated.params.id))
}

export async function enroll(req, res) {
  const enrollment = await service.enroll(req.auth.sub, req.validated.body.scheme_id)
  await enrollment.populate('schemeId')
  ok(res, service.serializeEnrollment(enrollment), 201)
}
