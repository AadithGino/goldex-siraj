import { Router } from 'express'
import * as controller from '../../controllers/admin/admin.rate.controller.js'
import { authenticateStaff, authorizeStaffRoles } from '../../middlewares/auth.js'
import { validate } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { goldRateSchema, stoneRateSchema } from '../../validators/commerce.validators.js'

const router = Router()
router.use(authenticateStaff)
router.get('/gold', asyncHandler(controller.goldList))
router.post('/gold', authorizeStaffRoles('manager'), validate(goldRateSchema), asyncHandler(controller.goldSet))
router.get('/stone', asyncHandler(controller.stoneList))
router.post('/stone', authorizeStaffRoles('manager'), validate(stoneRateSchema), asyncHandler(controller.stoneSet))
router.delete('/stone/:id', authorizeStaffRoles('manager'), asyncHandler(controller.stoneDelete))
export default router
