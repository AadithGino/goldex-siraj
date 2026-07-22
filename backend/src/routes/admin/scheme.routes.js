import { Router } from 'express'
import * as controller from '../../controllers/admin/admin.scheme.controller.js'
import { authenticateStaff, authorizeStaffRoles } from '../../middlewares/auth.js'
import { validateRequest } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import {
  enrollmentIdParamSchema,
  enrollmentListQuerySchema,
  installmentPaySchema,
  schemeCancelSchema,
  schemeCompleteSchema,
  schemeCreateSchema,
  schemeListQuerySchema,
  schemeUpdateSchema,
} from '../../validators/commerce.validators.js'

const router = Router()
router.use(authenticateStaff)

router.get('/', validateRequest({ query: schemeListQuerySchema }), asyncHandler(controller.list))
router.post('/', authorizeStaffRoles('manager'), validateRequest(schemeCreateSchema), asyncHandler(controller.create))
router.patch('/:id', authorizeStaffRoles('manager'), validateRequest(schemeUpdateSchema), asyncHandler(controller.update))

router.get(
  '/enrollments/all',
  validateRequest({ query: enrollmentListQuerySchema }),
  asyncHandler(controller.enrollments),
)
router.get(
  '/enrollments/:id',
  validateRequest({ params: enrollmentIdParamSchema }),
  asyncHandler(controller.enrollmentDetail),
)
router.patch(
  '/enrollments/:id',
  authorizeStaffRoles('manager'),
  validateRequest(schemeCancelSchema),
  asyncHandler(controller.updateEnrollment),
)
router.post(
  '/enrollments/:id/complete',
  authorizeStaffRoles('manager'),
  validateRequest(schemeCompleteSchema),
  asyncHandler(controller.completeEnrollment),
)
router.post(
  '/enrollments/:id/installments/:installmentId/pay',
  authorizeStaffRoles('manager'),
  validateRequest(installmentPaySchema),
  asyncHandler(controller.recordPayment),
)
router.post(
  '/installments/:installmentId/pay',
  authorizeStaffRoles('manager'),
  validateRequest(installmentPaySchema),
  asyncHandler(controller.recordPaymentById),
)

export default router
