import { Router } from 'express'
import * as controller from '../../controllers/admin/admin.custom-request.controller.js'
import { authenticateStaff, authorizeStaffRoles } from '../../middlewares/auth.js'
import { validateRequest } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import {
  customRequestCompleteBody,
  customRequestDeclineBody,
  customRequestIdParamSchema,
  customRequestListQuerySchema,
  customRequestQuoteBody,
} from '../../validators/custom-request.validators.js'

const router = Router()
router.use(authenticateStaff)
router.get(
  '/',
  validateRequest({ query: customRequestListQuerySchema }),
  asyncHandler(controller.list),
)
router.get(
  '/:id',
  validateRequest({ params: customRequestIdParamSchema }),
  asyncHandler(controller.getOne),
)
router.post(
  '/:id/quote',
  authorizeStaffRoles('manager'),
  validateRequest({ params: customRequestIdParamSchema, body: customRequestQuoteBody }),
  asyncHandler(controller.quote),
)
router.post(
  '/:id/decline',
  authorizeStaffRoles('manager'),
  validateRequest({ params: customRequestIdParamSchema, body: customRequestDeclineBody }),
  asyncHandler(controller.decline),
)
router.post(
  '/:id/complete',
  authorizeStaffRoles('manager'),
  validateRequest({ params: customRequestIdParamSchema, body: customRequestCompleteBody }),
  asyncHandler(controller.complete),
)
export default router
