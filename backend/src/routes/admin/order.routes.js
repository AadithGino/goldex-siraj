import { Router } from 'express'
import * as controller from '../../controllers/admin/admin.order.controller.js'
import { authenticateStaff, authorizeStaffRoles } from '../../middlewares/auth.js'
import { validate, validateRequest } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { idParamSchema, orderListQuerySchema } from '../../validators/common.schemas.js'
import {
  codHandoverSchema,
  manualPaymentSchema,
  updateOrderStatusSchema,
} from '../../validators/order.validators.js'

const router = Router()
router.use(authenticateStaff)
router.get('/', validateRequest({ query: orderListQuerySchema }), asyncHandler(controller.list))
router.get('/:id', validateRequest({ params: idParamSchema }), asyncHandler(controller.get))
router.patch('/:id/status', validate(updateOrderStatusSchema), asyncHandler(controller.status))
router.post('/:id/cod-handover', validate(codHandoverSchema), asyncHandler(controller.handover))
router.post('/:id/manual-payment', authorizeStaffRoles('manager'), validate(manualPaymentSchema), asyncHandler(controller.manualPayment))
export default router
