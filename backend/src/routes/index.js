import { Router } from 'express'
import adminRouter from './admin/index.js'
import customerRouter from './customer/index.js'
import staffRouter from './staff/index.js'
import webhookRouter from './webhooks.routes.js'

const router = Router()
router.use('/webhooks', webhookRouter)
router.use('/admin', adminRouter)
router.use('/staff', staffRouter)
router.use('/customer', customerRouter)

export default router
