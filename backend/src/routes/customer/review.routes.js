import { Router } from 'express'
import * as controller from '../../controllers/customer/customer.review.controller.js'
import { authenticateCustomer } from '../../middlewares/auth.js'
import { validate } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { reviewSubmitSchema } from '../../validators/commerce.validators.js'

const router = Router()
router.get('/product/:productId', asyncHandler(controller.list))
router.get('/mine/:productId', authenticateCustomer, asyncHandler(controller.mine))
router.post('/', authenticateCustomer, validate(reviewSubmitSchema), asyncHandler(controller.submit))
export default router
