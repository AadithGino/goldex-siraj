import { Router } from 'express'
import * as controller from '../../controllers/customer/customer.return.controller.js'
import { authenticateCustomer } from '../../middlewares/auth.js'
import { validate } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requestReturnSchema } from '../../validators/order.validators.js'
const router = Router()
router.use(authenticateCustomer)
router.get('/returns', asyncHandler(controller.list))
router.post('/returns', validate(requestReturnSchema), asyncHandler(controller.create))
router.get('/wallet', asyncHandler(controller.wallet))
router.get('/wallet/transactions', asyncHandler(controller.walletTransactions))
export default router
