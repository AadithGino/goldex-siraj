import { Router } from 'express'
import * as controller from '../../controllers/customer/customer.scheme.controller.js'
import { authenticateCustomer } from '../../middlewares/auth.js'
import { validateRequest } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import {
  enrollmentIdParamSchema,
  enrollmentListQuerySchema,
  schemeEnrollSchema,
} from '../../validators/commerce.validators.js'

const router = Router()
router.get('/', asyncHandler(controller.list))
router.get(
  '/enrollments',
  authenticateCustomer,
  validateRequest({ query: enrollmentListQuerySchema }),
  asyncHandler(controller.enrollments),
)
router.get(
  '/enrollments/:id',
  authenticateCustomer,
  validateRequest({ params: enrollmentIdParamSchema }),
  asyncHandler(controller.enrollmentDetail),
)
router.post(
  '/enrollments',
  authenticateCustomer,
  validateRequest(schemeEnrollSchema),
  asyncHandler(controller.enroll),
)
export default router
