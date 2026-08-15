import { Router } from 'express'
import * as controller from '../../controllers/admin/admin.sell-request.controller.js'
import { authenticateStaff, authorizeStaffRoles } from '../../middlewares/auth.js'
import { validateRequest } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import {
  sellRequestCompleteBody,
  sellRequestDeclineBody,
  sellRequestIdParamSchema,
  sellRequestInfoBody,
  sellRequestListQuerySchema,
  sellRequestOfferBody,
} from '../../validators/sell-request.validators.js'

const router = Router()
router.use(authenticateStaff)
router.get(
  '/',
  validateRequest({ query: sellRequestListQuerySchema }),
  asyncHandler(controller.list),
)
router.get(
  '/:id',
  validateRequest({ params: sellRequestIdParamSchema }),
  asyncHandler(controller.getOne),
)
router.post(
  '/:id/offer',
  authorizeStaffRoles('manager'),
  validateRequest({ params: sellRequestIdParamSchema, body: sellRequestOfferBody }),
  asyncHandler(controller.offer),
)
router.post(
  '/:id/request-info',
  authorizeStaffRoles('manager'),
  validateRequest({ params: sellRequestIdParamSchema, body: sellRequestInfoBody }),
  asyncHandler(controller.requestInfo),
)
router.post(
  '/:id/decline',
  authorizeStaffRoles('manager'),
  validateRequest({ params: sellRequestIdParamSchema, body: sellRequestDeclineBody }),
  asyncHandler(controller.decline),
)
router.post(
  '/:id/complete',
  authorizeStaffRoles('manager'),
  validateRequest({ params: sellRequestIdParamSchema, body: sellRequestCompleteBody }),
  asyncHandler(controller.complete),
)
export default router
