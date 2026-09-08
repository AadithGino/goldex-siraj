import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import * as paymobController from '../controllers/webhooks/paymob.controller.js'
import * as tabbyController from '../controllers/webhooks/tabby.controller.js'

const router = Router()
router.post('/paymob', asyncHandler(paymobController.handleWebhook))
router.post('/tabby', asyncHandler(tabbyController.handleWebhook))

export default router
