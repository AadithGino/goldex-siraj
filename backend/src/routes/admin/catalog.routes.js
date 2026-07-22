import { Router } from 'express'
import { z } from 'zod'
import * as controller from '../../controllers/admin/admin.catalog.controller.js'
import { authenticateStaff, authorizeStaffRoles } from '../../middlewares/auth.js'
import { validate, validateRequest } from '../../middlewares/validate.js'
import { validateCatalogDelete, validateCatalogWrite } from '../../middlewares/validateCatalog.js'
import { AppError } from '../../utils/AppError.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import {
  createVariantCompleteSchema,
  setPrimaryImageSchema,
  storeSettingsBody,
  taxSettingsBody,
  updateVariantCompleteSchema,
} from '../../validators/catalog.validators.js'
import { catalogListQuerySchema, catalogResourceEnum } from '../../validators/common.schemas.js'

const router = Router()
const resources = new Set(['categories', 'brands', 'products', 'variants', 'images', 'stones', 'certificates', 'banners', 'cms-pages'])

router.use(authenticateStaff)
router.param('resource', (req, res, next, value) => (
  resources.has(value)
    ? next()
    : res.status(404).json({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Catalog resource not found' } })
))

function validateSettingsWrite(req, res, next) {
  const kind = req.params.kind
  if (kind !== 'store' && kind !== 'tax') {
    return next(new AppError(404, 'NOT_FOUND', 'Settings kind not found'))
  }
  const body = kind === 'store' ? storeSettingsBody : taxSettingsBody
  return validateRequest({
    params: z.object({ kind: z.enum(['store', 'tax']) }),
    body,
  })(req, res, next)
}

router.patch(
  '/settings/:kind',
  authorizeStaffRoles('manager'),
  validateSettingsWrite,
  asyncHandler(controller.updateSettings),
)

router.post(
  '/variants/complete',
  authorizeStaffRoles('manager'),
  validate(createVariantCompleteSchema),
  asyncHandler(controller.createVariantComplete),
)
router.patch(
  '/variants/:id/complete',
  authorizeStaffRoles('manager'),
  validate(updateVariantCompleteSchema),
  asyncHandler(controller.updateVariantComplete),
)
router.post(
  '/images/:id/set-primary',
  authorizeStaffRoles('manager'),
  validate(setPrimaryImageSchema),
  asyncHandler(controller.setPrimaryImage),
)

router.get(
  '/:resource',
  validateRequest({
    params: z.object({ resource: catalogResourceEnum }),
    query: catalogListQuerySchema,
  }),
  asyncHandler(controller.list),
)
router.get(
  '/:resource/:id',
  validateRequest({
    params: z.object({
      resource: catalogResourceEnum,
      id: z.string().min(1).max(200),
    }),
  }),
  asyncHandler(controller.getOne),
)
router.post(
  '/:resource',
  authorizeStaffRoles('manager'),
  validateCatalogWrite('create'),
  asyncHandler(controller.create),
)
router.patch(
  '/:resource/:id',
  authorizeStaffRoles('manager'),
  validateCatalogWrite('update'),
  asyncHandler(controller.update),
)
router.delete(
  '/:resource/:id',
  authorizeStaffRoles('manager'),
  validateCatalogDelete(),
  asyncHandler(controller.remove),
)

export default router
