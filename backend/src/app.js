import path from 'node:path'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import hpp from 'hpp'
import { rateLimit } from 'express-rate-limit'
import pinoHttp from 'pino-http'
import { config } from './config/env.js'
import { logger } from './config/logger.js'
import { requestId } from './middlewares/requestId.js'
import { sanitize } from './middlewares/sanitize.js'
import { auditAdminMutation } from './middlewares/audit.js'
import { errorHandler, notFound } from './middlewares/errorHandler.js'
import routes from './routes/index.js'

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(requestId)
app.use(pinoHttp({ logger, genReqId: (req) => req.id }))
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin(origin, callback) { callback(null, !origin || config.clientOrigins.includes(origin)) }, credentials: true }))
app.use(rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false }))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: false, limit: '1mb' }))
app.use(cookieParser())
app.use(sanitize)
app.use(hpp())
app.use(auditAdminMutation)
app.use(compression())
if (config.storage.driver === 'local') app.use('/uploads', express.static(path.resolve(config.storage.localPath), { fallthrough: false, maxAge: config.nodeEnv === 'production' ? '1d' : 0 }))

app.get('/health/live', (_req, res) => res.json({ status: 'ok' }))
app.get('/health/ready', async (_req, res, next) => {
  try {
    const { getReadiness } = await import('./services/health.service.js')
    const result = await getReadiness()
    res.status(result.ready ? 200 : 503).json({ status: result.ready ? 'ready' : 'not_ready', ...result })
  } catch (error) {
    next(error)
  }
})
app.use('/api/v1', routes)
app.use(notFound)
app.use(errorHandler)

export default app
