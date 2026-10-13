#!/usr/bin/env node
/**
 * Run on the server after editing .env — prints the real startup error (not redacted logs).
 * Usage: cd backend && node scripts/check-startup.js
 */
import 'dotenv/config'
import mongoose from 'mongoose'

function fail(step, message, detail) {
  console.error(`\n❌ ${step}: ${message}`)
  if (detail) console.error(detail)
  process.exit(1)
}

console.log('Checking environment…')

let config
let assertProductionConfig
let assertReplicaSetCapable
try {
  const envMod = await import('../src/config/env.js')
  config = envMod.config
  const health = await import('../src/services/health.service.js')
  assertProductionConfig = health.assertProductionConfig
  assertReplicaSetCapable = health.assertReplicaSetCapable
} catch (error) {
  fail('env', error.message)
}

console.log(`  NODE_ENV=${config.nodeEnv}`)
console.log(`  MONGODB_URI host=${safeMongoHost(config.mongoUri)}`)
console.log(`  STORAGE_DRIVER=${config.storage.driver}`)
console.log(`  TABBY_ENABLED=${config.tabby.enabled}`)

if (config.nodeEnv === 'production') {
  try {
    assertProductionConfig(config)
    console.log('  Production config rules: OK')
  } catch (error) {
    fail('production-config', error.message)
  }
}

console.log('\nConnecting to MongoDB (10s timeout)…')
try {
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 10_000,
    autoIndex: false,
  })
  console.log('  MongoDB: connected')
} catch (error) {
  fail(
    'mongodb',
    error.message,
    [
      'Common fixes:',
      '  • Use the same MONGODB_URI that worked before (see MONGODB_PROD_URL in old .env).',
      '  • In Atlas: Network Access → allow Lightsail instance IP (or 0.0.0.0/0 temporarily).',
      '  • Wrap the URI in double quotes in .env if it contains & characters.',
    ].join('\n'),
  )
}

if (config.nodeEnv === 'production') {
  try {
    await assertReplicaSetCapable(mongoose.connection)
    console.log('  Replica set: OK')
  } catch (error) {
    fail(
      'replica-set',
      error.message,
      'Production requires MongoDB Atlas or a replica set — not a standalone mongod on the VM.',
    )
  }
}

await mongoose.disconnect()
console.log('\n✅ Startup checks passed. Run: npm start\n')

function safeMongoHost(uri) {
  try {
    const u = new URL(uri.replace(/^mongodb(\+srv)?:/, 'https:'))
    return u.hostname || '(unknown)'
  } catch {
    return '(parse error — quote the URI in .env)'
  }
}
