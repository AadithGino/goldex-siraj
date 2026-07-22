import { Router } from 'express'
import * as controller from '../../controllers/customer/catalog.controller.js'
import { validateRequest } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { catalogListQuerySchema, catalogResourceEnum } from '../../validators/common.schemas.js'
import { z } from 'zod'

const router = Router()
const resources = new Set(['categories', 'brands', 'products', 'variants', 'images', 'stones', 'certificates', 'banners', 'cms-pages'])
router.param('resource', (req, res, next, value) => (
  resources.has(value)
    ? next()
    : res.status(404).json({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Catalog resource not found' } })
))
router.get('/bootstrap', asyncHandler(controller.bootstrap))
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
export default router
