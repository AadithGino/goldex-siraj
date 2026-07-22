import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import * as controller from '../../controllers/customer/customer.auth.controller.js'
import { authenticateCustomer } from '../../middlewares/auth.js'
import { validate } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { profileSchema, sendOtpSchema, verifyOtpSchema } from '../../validators/auth.validators.js'

const router = Router()
const otpLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10, legacyHeaders: false, standardHeaders: 'draft-8' })
router.post('/otp/send', otpLimit, validate(sendOtpSchema), asyncHandler(controller.sendOtp))
router.post('/otp/verify', otpLimit, validate(verifyOtpSchema), asyncHandler(controller.verifyOtp))
router.post('/refresh', asyncHandler(controller.refresh))
router.post('/logout', asyncHandler(controller.logout))
router.get('/me', authenticateCustomer, asyncHandler(controller.me))
router.patch('/me', authenticateCustomer, validate(profileSchema), asyncHandler(controller.updateProfile))
export default router
