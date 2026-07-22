import { Router } from 'express'
import * as controller from '../../controllers/admin/admin.return.controller.js'
import { authenticateStaff, authorizeStaffRoles } from '../../middlewares/auth.js'
import { validate, validateQuery } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { returnsListQuerySchema } from '../../validators/common.schemas.js'
import { resolveReturnSchema } from '../../validators/order.validators.js'

const router = Router()
router.use(authenticateStaff)
router.get('/', validateQuery(returnsListQuerySchema), asyncHandler(controller.list))
router.post('/:id/resolve', authorizeStaffRoles('manager'), validate(resolveReturnSchema), asyncHandler(controller.resolve))
export default router
