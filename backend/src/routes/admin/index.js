import { Router } from 'express'
import authRoutes from './auth.routes.js'
import catalogRoutes from './catalog.routes.js'
import rateRoutes from './rate.routes.js'
import mediaRoutes from './media.routes.js'
import schemeRoutes from './scheme.routes.js'
import orderRoutes from './order.routes.js'
import returnRoutes from './return.routes.js'
import reportRoutes from './report.routes.js'
import userRoutes from './user.routes.js'
import operationsRoutes from './operations.routes.js'
import reviewRoutes from './review.routes.js'
import customRequestRoutes from './custom-request.routes.js'
import sellRequestRoutes from './sell-request.routes.js'
const router = Router()
router.use('/auth', authRoutes)
router.use('/catalog', catalogRoutes)
router.use('/rates', rateRoutes)
router.use('/media', mediaRoutes)
router.use('/schemes', schemeRoutes)
router.use('/orders', orderRoutes)
router.use('/returns', returnRoutes)
router.use('/reports', reportRoutes)
router.use('/', userRoutes)
router.use('/', operationsRoutes)
router.use('/reviews', reviewRoutes)
router.use('/custom-requests', customRequestRoutes)
router.use('/sell-requests', sellRequestRoutes)
export default router
