import { Router } from 'express'
import * as controller from '../../controllers/customer/customer.custom-request.controller.js'
import { authenticateCustomer } from '../../middlewares/auth.js'
import { validateRequest } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import {
  customRequestCreateBody,
  customRequestDeclineBody,
  customRequestIdParamSchema,
} from '../../validators/custom-request.validators.js'

const router = Router()
router.use(authenticateCustomer)
router.get('/', asyncHandler(controller.list))
router.get(
  '/:id',
  validateRequest({ params: customRequestIdParamSchema }),
  asyncHandler(controller.getOne),
)
router.post('/', validateRequest({ body: customRequestCreateBody }), asyncHandler(controller.create))
router.post(
  '/:id/cancel',
  validateRequest({ params: customRequestIdParamSchema }),
  asyncHandler(controller.cancel),
)
router.post(
  '/:id/accept',
  validateRequest({ params: customRequestIdParamSchema }),
  asyncHandler(controller.accept),
)
router.post(
  '/:id/decline',
  validateRequest({ params: customRequestIdParamSchema, body: customRequestDeclineBody }),
  asyncHandler(controller.decline),
)
export default router
