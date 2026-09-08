import { createServer } from 'node:http'
import app from './src/app.js'
import { config } from './src/config/env.js'
import { connectDatabase, disconnectDatabase } from './src/config/database.js'
import { logger } from './src/config/logger.js'
import { assertProductionConfig, assertReplicaSetCapable } from './src/services/health.service.js'
import { startPaymentReconciliationWorker } from './src/services/payment.reconciliation.service.js'

const server = createServer(app)
let stopPaymentReconciliation = null

async function start() {
  assertProductionConfig()
  await connectDatabase()
  await assertReplicaSetCapable()
  if (config.paymentReconciliation.enabled) {
    stopPaymentReconciliation = startPaymentReconciliationWorker({
      intervalSeconds: config.paymentReconciliation.intervalSeconds,
      batchSize: config.paymentReconciliation.batchSize,
    })
  }
  server.listen(config.port, () => logger.info({ port: config.port }, 'API listening'))
}

async function shutdown(signal) {
  logger.info({ signal }, 'Graceful shutdown started')
  if (stopPaymentReconciliation) {
    stopPaymentReconciliation()
    stopPaymentReconciliation = null
  }
  server.close(async () => {
    await disconnectDatabase()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('unhandledRejection', (error) => logger.error({ error }, 'Unhandled rejection'))
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception')
  process.exit(1)
})

start().catch((error) => {
  logger.fatal({ error }, 'Startup failed')
  process.exit(1)
})
