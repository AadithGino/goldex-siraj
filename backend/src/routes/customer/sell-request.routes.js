import { Router } from 'express'
import * as controller from '../../controllers/customer/customer.sell-request.controller.js'
import { authenticateCustomer } from '../../middlewares/auth.js'
import { validateRequest } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import {
  sellRequestCreateBody,
  sellRequestDeclineBody,
  sellRequestIdParamSchema,
  sellRequestReplyBody,
} from '../../validators/sell-request.validators.js'

const router = Router()
router.use(authenticateCustomer)
router.get('/', asyncHandler(controller.list))
router.get(
  '/:id',
  validateRequest({ params: sellRequestIdParamSchema }),
  asyncHandler(controller.getOne),
)
router.post('/', validateRequest({ body: sellRequestCreateBody }), asyncHandler(controller.create))
router.post(
  '/:id/cancel',
  validateRequest({ params: sellRequestIdParamSchema }),
  asyncHandler(controller.cancel),
)
router.post(
  '/:id/reply',
  validateRequest({ params: sellRequestIdParamSchema, body: sellRequestReplyBody }),
  asyncHandler(controller.reply),
)
router.post(
  '/:id/accept',
  validateRequest({ params: sellRequestIdParamSchema }),
  asyncHandler(controller.accept),
)
router.post(
  '/:id/decline',
  validateRequest({ params: sellRequestIdParamSchema, body: sellRequestDeclineBody }),
  asyncHandler(controller.decline),
)
export default router
