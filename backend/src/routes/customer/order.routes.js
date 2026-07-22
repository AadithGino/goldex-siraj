import { Router } from 'express'
import * as controller from '../../controllers/customer/customer.order.controller.js'
import { authenticateCustomer } from '../../middlewares/auth.js'
import { validate } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { placeOrderSchema } from '../../validators/order.validators.js'
const router = Router()
router.use(authenticateCustomer)
router.get('/', asyncHandler(controller.list))
router.post('/', validate(placeOrderSchema), asyncHandler(controller.place))
router.get('/:id', asyncHandler(controller.get))
export default router
