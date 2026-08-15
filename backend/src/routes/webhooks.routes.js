import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import * as controller from '../controllers/webhooks/paymob.controller.js'

const router = Router()
router.post('/paymob', asyncHandler(controller.handleWebhook))

export default router
