import { Router } from 'express'
import * as controller from '../../controllers/customer/customer.order.controller.js'
import { authenticateCustomer } from '../../middlewares/auth.js'
import { validate } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { placeOrderSchema, objectId } from '../../validators/order.validators.js'
import { z } from 'zod'
const router = Router()
router.use(authenticateCustomer)
router.get('/', asyncHandler(controller.list))
router.post('/', validate(placeOrderSchema), asyncHandler(controller.place))
router.post('/:id/paymob-checkout', validate({ params: z.object({ id: objectId }) }), asyncHandler(controller.paymobCheckout))
router.post(
  '/:id/paymob-confirm',
  validate({
    params: z.object({ id: objectId }),
    body: z.record(z.string(), z.any()).optional().default({}),
  }),
  asyncHandler(controller.paymobConfirm),
)
router.get('/:id', asyncHandler(controller.get))
export default router
