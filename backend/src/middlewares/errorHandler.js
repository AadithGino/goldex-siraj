import { ZodError } from 'zod'
import { AppError } from '../utils/AppError.js'
import { logger } from '../config/logger.js'

export function notFound(req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} was not found`))
}

export function errorHandler(error, req, res, _next) {
  let normalized = error
  if (error instanceof ZodError) normalized = new AppError(422, 'VALIDATION_ERROR', 'Request validation failed', error.flatten())
  if (error?.name === 'CastError') normalized = new AppError(400, 'INVALID_ID', 'Invalid resource identifier')
  if (error?.code === 11000) normalized = new AppError(409, 'DUPLICATE_RESOURCE', 'A resource with these values already exists', error.keyValue)
  if (!(normalized instanceof AppError)) normalized = new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred')
  if (normalized.statusCode >= 500) logger.error({ err: error, requestId: req.id }, 'Request failed')
  res.status(normalized.statusCode).json({ success: false, error: { code: normalized.code, message: normalized.message, ...(normalized.details ? { details: normalized.details } : {}) }, requestId: req.id })
}
