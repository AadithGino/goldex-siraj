import { Router } from 'express'
import adminRouter from './admin/index.js'
import customerRouter from './customer/index.js'
import staffRouter from './staff/index.js'

const router = Router()
router.use('/admin', adminRouter)
router.use('/staff', staffRouter)
router.use('/customer', customerRouter)

export default router
