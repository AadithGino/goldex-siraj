import { randomUUID } from 'node:crypto'

export function requestId(req, res, next) {
  req.id = req.get('x-request-id') || randomUUID()
  res.set('x-request-id', req.id)
  next()
}
