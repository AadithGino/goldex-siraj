#!/usr/bin/env node
/**
 * Tabby QA pre-flight — checks env/config without printing secrets.
 * Usage: node backend/scripts/tabby-qa-preflight.js
 */
import 'dotenv/config'
import { config } from '../src/config/env.js'

const checks = []

function pass(label) {
  checks.push({ ok: true, label })
}

function fail(label, hint) {
  checks.push({ ok: false, label, hint })
}

const t = config.tabby

if (t.enabled) pass('TABBY_ENABLED=true')
else fail('TABBY_ENABLED', 'Set TABBY_ENABLED=true on staging')

if (t.secretKey?.startsWith('sk_test_')) pass('TABBY_SECRET_KEY looks like test key')
else if (t.secretKey?.startsWith('sk_')) fail('TABBY_SECRET_KEY', 'Use sk_test_… for QA scenarios (success flow needs test keys)')
else fail('TABBY_SECRET_KEY', 'Set TABBY_SECRET_KEY')

if (t.publicKey?.startsWith('pk_')) pass('TABBY_PUBLIC_KEY set')
else fail('TABBY_PUBLIC_KEY', 'Set TABBY_PUBLIC_KEY for frontend snippets')

if (t.merchantCode) pass('TABBY_MERCHANT_CODE set')
else fail('TABBY_MERCHANT_CODE', 'Set merchant code from Tabby dashboard')

if (t.webhookSecret && t.webhookSecret.length >= 16) pass('TABBY_WEBHOOK_SECRET set')
else fail('TABBY_WEBHOOK_SECRET', 'Set a long random secret; register same value in Tabby webhook header')

if (t.webhookHeaderName) pass(`Webhook header name: ${t.webhookHeaderName}`)
else fail('TABBY_WEBHOOK_HEADER_NAME', 'Default X-Goldex-Tabby-Auth')

const apiPublic = process.env.API_PUBLIC_URL || ''
if (apiPublic.startsWith('https://')) pass(`API_PUBLIC_URL=${apiPublic}`)
else fail('API_PUBLIC_URL', 'Set public HTTPS API origin (no path), e.g. https://goldex.retailkerala.com')

function apiOrigin(url) {
  const base = String(url || '').replace(/\/+$/, '')
  if (base.endsWith('/api/v1')) return base.slice(0, -'/api/v1'.length)
  return base
}

const webhookUrl = apiPublic
  ? `${apiOrigin(apiPublic)}/api/v1/webhooks/tabby`
  : '(set API_PUBLIC_URL first)'
console.log('\nTabby webhook URL to register:\n ', webhookUrl, '\n')

for (const row of checks) {
  const tag = row.ok ? '[OK]  ' : '[FAIL]'
  console.log(tag, row.label)
  if (!row.ok && row.hint) console.log('       →', row.hint)
}

const failed = checks.filter((c) => !c.ok).length
console.log(`\n${checks.length - failed}/${checks.length} checks passed.\n`)
process.exit(failed ? 1 : 0)
