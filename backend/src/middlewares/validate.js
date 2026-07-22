import { ZodError, z } from 'zod'
import { AppError } from '../utils/AppError.js'

function isZodSchema(value) {
  return Boolean(value && typeof value.safeParse === 'function')
}

function isRequestConfig(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && !isZodSchema(value)
    && ('body' in value || 'params' in value || 'query' in value),
  )
}

/** Plain object for parsing; never mutate Express req.query / req.params. */
function plainObject(value) {
  if (value == null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) return value
  return { ...value }
}

function failValidation(error, next) {
  if (error instanceof ZodError) {
    return next(new AppError(422, 'VALIDATION_ERROR', 'Request validation failed', error.flatten()))
  }
  return next(error)
}

/**
 * Sectioned request validation.
 * - Only sections with schemas are validated.
 * - Missing GET/DELETE bodies are never validated.
 * - When a body schema is provided, undefined/null body is treated as {}.
 */
export function validateRequest({ body, params, query } = {}) {
  return (req, _res, next) => {
    try {
      const validated = {
        body: req.body,
        params: req.params,
        query: req.query,
      }

      if (params) {
        const result = params.safeParse(plainObject(req.params))
        if (!result.success) return failValidation(result.error, next)
        validated.params = result.data
      }

      if (query) {
        const result = query.safeParse(plainObject(req.query))
        if (!result.success) return failValidation(result.error, next)
        validated.query = result.data
      }

      if (body) {
        const result = body.safeParse(plainObject(req.body))
        if (!result.success) return failValidation(result.error, next)
        validated.body = result.data
      }

      req.validated = validated
      next()
    } catch (error) {
      failValidation(error, next)
    }
  }
}

export const validateBody = (schema) => validateRequest({ body: schema })
export const validateParams = (schema) => validateRequest({ params: schema })
export const validateQuery = (schema) => validateRequest({ query: schema })

/**
 * Accepts either:
 * - validateRequest config `{ body?, params?, query? }`
 * - legacy Zod envelope object `{ body, params, query }` schemas
 *
 * Legacy envelopes always normalize missing body → {} so GET never fails on body.
 */
export function validate(schemaOrConfig) {
  if (isRequestConfig(schemaOrConfig)) {
    return validateRequest(schemaOrConfig)
  }

  if (isZodSchema(schemaOrConfig)) {
    return (req, _res, next) => {
      try {
        const parsed = schemaOrConfig.parse({
          body: req.body == null ? {} : req.body,
          params: req.params == null ? {} : req.params,
          query: req.query == null ? {} : req.query,
        })
        req.validated = parsed
        next()
      } catch (error) {
        failValidation(error, next)
      }
    }
  }

  return (_req, _res, next) => next(new AppError(500, 'INTERNAL_ERROR', 'Invalid validation configuration'))
}

/** Helper to build legacy-compatible envelope schemas during migration. */
export function envelopeSchema(body, params = z.object({}).passthrough(), query = z.object({}).passthrough()) {
  return z.object({ body, params, query })
}
