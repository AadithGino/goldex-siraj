import { AuditLog } from '../models/audit.models.js'
import { logger } from '../config/logger.js'

const methods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const redact = (body = {}) => Object.fromEntries(Object.entries(body).filter(([key]) => !['password', 'code', 'token'].some((secret) => key.toLowerCase().includes(secret))))

export function auditAdminMutation(req, res, next) {
  if (!methods.has(req.method) || !req.originalUrl.startsWith('/api/v1/admin/')) return next()
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300 && req.auth?.type === 'staff') {
      AuditLog.create({ actorId: req.auth.sub, actorRole: req.auth.role, action: `${req.method.toLowerCase()} ${req.route?.path || req.path}`, entityType: req.path.split('/').filter(Boolean)[0] || 'admin', metadata: { path: req.originalUrl, body: redact(req.body), statusCode: res.statusCode }, requestId: req.id, ip: req.ip }).catch((err) => logger.error({ err, requestId: req.id }, 'Could not write admin audit log'))
    }
  })
  next()
}
