import { Router } from 'express'
import authRoutes from './auth.routes.js'
import catalogRoutes from './catalog.routes.js'
import mediaRoutes from './media.routes.js'
import commerceRoutes from './commerce.routes.js'
import schemeRoutes from './scheme.routes.js'
import orderRoutes from './order.routes.js'
import returnRoutes from './return.routes.js'
import reviewRoutes from './review.routes.js'
import customRequestRoutes from './custom-request.routes.js'
import sellRequestRoutes from './sell-request.routes.js'
const router = Router()
router.use('/auth', authRoutes)
router.use('/catalog', catalogRoutes)
router.use('/media', mediaRoutes)
router.use('/', commerceRoutes)
router.use('/schemes', schemeRoutes)
router.use('/orders', orderRoutes)
router.use('/', returnRoutes)
router.use('/reviews', reviewRoutes)
router.use('/custom-requests', customRequestRoutes)
router.use('/sell-requests', sellRequestRoutes)
export default router
