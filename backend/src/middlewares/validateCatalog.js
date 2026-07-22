import { AppError } from '../utils/AppError.js'
import { validateRequest } from './validate.js'
import {
  catalogWriteSchemaFor,
  catalogResourceSchemas,
} from '../validators/catalog.validators.js'
import { catalogResourceEnum, objectId } from '../validators/common.schemas.js'
import { z } from 'zod'

/**
 * POST/PATCH /admin/catalog/:resource[/:id]
 * Selects the correct body schema from the resource map.
 */
export function validateCatalogWrite(mode = 'create') {
  return (req, res, next) => {
    const resource = req.params.resource
    if (!catalogResourceSchemas[resource]) {
      return next(new AppError(404, 'RESOURCE_NOT_FOUND', 'Catalog resource not found'))
    }
    const body = catalogWriteSchemaFor(resource, mode)
    const params = mode === 'create'
      ? z.object({ resource: catalogResourceEnum })
      : z.object({ resource: catalogResourceEnum, id: objectId })
    return validateRequest({ body, params })(req, res, next)
  }
}

export function validateCatalogDelete() {
  return validateRequest({
    params: z.object({ resource: catalogResourceEnum, id: objectId }),
  })
}
