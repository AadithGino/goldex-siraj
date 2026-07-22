import { Router } from 'express'
import * as controller from '../../controllers/admin/admin.operations.controller.js'
import { authenticateStaff, authorizeStaffRoles } from '../../middlewares/auth.js'
import { validate, validateQuery, validateRequest } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { couponCreateSchema, couponUpdateSchema } from '../../validators/commerce.validators.js'
import {
  auditLogQuerySchema,
  idParamSchema,
  inventoryListQuerySchema,
  listFiltersQuerySchema,
  stockLedgerQuerySchema,
} from '../../validators/common.schemas.js'
import { setStockSchema, stockAdjustSchema } from '../../validators/order.validators.js'

const router = Router()
router.use(authenticateStaff)
router.get('/coupons', authorizeStaffRoles('manager'), validateQuery(listFiltersQuerySchema), asyncHandler(controller.coupons))
router.get('/coupons/usage-summary', authorizeStaffRoles('manager'), asyncHandler(controller.couponUsageSummary))
router.get(
  '/coupons/:id/usage',
  authorizeStaffRoles('manager'),
  validateRequest({ params: idParamSchema, query: listFiltersQuerySchema }),
  asyncHandler(controller.couponUsage),
)
router.post('/coupons', authorizeStaffRoles('manager'), validateRequest(couponCreateSchema), asyncHandler(controller.couponCreate))
router.patch('/coupons/:id', authorizeStaffRoles('manager'), validateRequest(couponUpdateSchema), asyncHandler(controller.couponUpdate))
router.delete('/coupons/:id', authorizeStaffRoles('manager'), validateRequest({ params: idParamSchema }), asyncHandler(controller.couponDelete))
router.get('/inventory/low-stock', validateQuery(inventoryListQuerySchema), asyncHandler(controller.lowStock))
router.get('/inventory/variants', validateQuery(inventoryListQuerySchema), asyncHandler(controller.variants))
router.post('/inventory/variants/:id/adjust', authorizeStaffRoles('manager'), validate(stockAdjustSchema), asyncHandler(controller.adjust))
router.post('/inventory/variants/:id/set-stock', authorizeStaffRoles('manager'), validate(setStockSchema), asyncHandler(controller.setStock))
router.get('/stock-ledger', validateQuery(stockLedgerQuerySchema), asyncHandler(controller.ledger))
router.get('/payment-events', authorizeStaffRoles('manager'), validateQuery(listFiltersQuerySchema), asyncHandler(controller.payments))
router.get('/audit-log', authorizeStaffRoles('manager'), validateQuery(auditLogQuerySchema), asyncHandler(controller.audit))
export default router
