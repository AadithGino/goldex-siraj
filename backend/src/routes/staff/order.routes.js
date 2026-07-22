import { Router } from 'express'
import * as controller from '../../controllers/staff/staff.order.controller.js'
import { authenticateStaff } from '../../middlewares/auth.js'
import { validate, validateRequest } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { idParamSchema, orderListQuerySchema } from '../../validators/common.schemas.js'
import {
  codHandoverSchema,
  updateOrderStatusSchema,
} from '../../validators/order.validators.js'

const router = Router()
router.use(authenticateStaff)
router.get('/', validateRequest({ query: orderListQuerySchema }), asyncHandler(controller.list))
router.get('/:id', validateRequest({ params: idParamSchema }), asyncHandler(controller.get))
router.patch('/:id/status', validate(updateOrderStatusSchema), asyncHandler(controller.status))
router.post('/:id/cod-handover', validate(codHandoverSchema), asyncHandler(controller.handover))
export default router
