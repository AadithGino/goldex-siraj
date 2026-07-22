import { Router } from 'express'
import * as controller from '../../controllers/admin/admin.review.controller.js'
import { authenticateStaff, authorizeStaffRoles } from '../../middlewares/auth.js'
import { validate, validateQuery } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { reviewModerateSchema } from '../../validators/commerce.validators.js'
import { reviewsListQuerySchema } from '../../validators/common.schemas.js'

const router = Router()
router.use(authenticateStaff)
router.get('/', validateQuery(reviewsListQuerySchema), asyncHandler(controller.list))
router.patch('/:id', authorizeStaffRoles('manager'), validate(reviewModerateSchema), asyncHandler(controller.moderate))
export default router
