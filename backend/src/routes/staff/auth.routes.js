import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import * as controller from '../../controllers/staff/staff.auth.controller.js'
import { authenticateStaff } from '../../middlewares/auth.js'
import { validate } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { changePasswordSchema, staffLoginSchema } from '../../validators/auth.validators.js'
const router = Router()
router.post('/login', rateLimit({ windowMs: 15 * 60_000, limit: 8 }), validate(staffLoginSchema), asyncHandler(controller.login))
router.post('/refresh', asyncHandler(controller.refresh))
router.post('/logout', asyncHandler(controller.logout))
router.post('/logout-all', authenticateStaff, asyncHandler(controller.logoutAll))
router.post('/change-password', authenticateStaff, validate(changePasswordSchema), asyncHandler(controller.changePassword))
router.get('/me', authenticateStaff, asyncHandler(controller.me))
export default router
