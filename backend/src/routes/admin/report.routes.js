import { Router } from 'express'
import * as controller from '../../controllers/admin/admin.report.controller.js'
import { authenticateStaff, authorizeStaffRoles } from '../../middlewares/auth.js'
import { validateQuery } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { reportQuerySchema } from '../../validators/common.schemas.js'

const router = Router()
router.use(authenticateStaff, authorizeStaffRoles('manager'))
router.get('/sales', validateQuery(reportQuerySchema), asyncHandler(controller.sales))
router.get('/top-products', validateQuery(reportQuerySchema), asyncHandler(controller.top))
router.get('/dashboard', asyncHandler(controller.dashboard))
export default router
