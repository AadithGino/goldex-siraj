import { Router } from 'express'
import * as controller from '../../controllers/admin/admin.user.controller.js'
import { authenticateStaff, authorizeStaffRoles } from '../../middlewares/auth.js'
import { validate, validateQuery, validateRequest } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { customerUpdateSchema, staffWriteSchema } from '../../validators/commerce.validators.js'
import { customerListQuerySchema, idParamSchema, listFiltersQuerySchema } from '../../validators/common.schemas.js'

const router = Router()
router.use(authenticateStaff)
router.get('/customers', validateQuery(customerListQuerySchema), asyncHandler(controller.customers))
router.get('/customers/:id', validateRequest({ params: idParamSchema }), asyncHandler(controller.customer))
router.patch('/customers/:id', authorizeStaffRoles('manager'), validate(customerUpdateSchema), asyncHandler(controller.customerUpdate))
router.get(
  '/customers/:id/wallet',
  validateRequest({ params: idParamSchema, query: listFiltersQuerySchema }),
  asyncHandler(controller.customerWallet),
)
router.get('/staff', authorizeStaffRoles('manager'), validateQuery(listFiltersQuerySchema), asyncHandler(controller.staff))
router.post('/staff', authorizeStaffRoles('owner'), validate(staffWriteSchema), asyncHandler(controller.staffCreate))
router.patch('/staff/:id', authorizeStaffRoles('owner'), validate(staffWriteSchema), asyncHandler(controller.staffUpdate))
export default router
