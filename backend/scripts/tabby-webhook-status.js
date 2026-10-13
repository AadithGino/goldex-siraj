#!/usr/bin/env node
/**
 * Tabby webhook diagnostics (run from backend/ with .env loaded).
 *
 *   node scripts/tabby-webhook-status.js
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env'), quiet: true })

const baseUrl = (process.env.TABBY_BASE_URL || 'https://api.tabby.ai').replace(/\/+$/, '')
const secretKey = process.env.TABBY_SECRET_KEY
const merchantCode = process.env.TABBY_MERCHANT_CODE

function apiOrigin() {
  const raw = (process.env.TABBY_WEBHOOK_URL || process.env.API_PUBLIC_URL || '')
    .replace(/\/+$/, '')
    .replace(/\/api\/v1$/i, '')
  return raw || '(not set)'
}

async function main() {
  console.log('--- Tabby webhook diagnostics ---\n')
  console.log('Merchant code:', merchantCode || '(missing)')
  console.log(
    'API key type:',
    secretKey?.startsWith('sk_test') ? 'TEST (sk_test_*)' : secretKey?.startsWith('sk_') ? 'LIVE (sk_*)' : '(missing)',
  )
  console.log('API_PUBLIC_URL / webhook host:', apiOrigin())
  console.log('Expected webhook URL:', `${apiOrigin().replace(/\(not set\)/, 'https://goldex.retailkerala.com')}/api/v1/webhooks/tabby`)
  console.log('TABBY_WEBHOOK_SECRET on server:', process.env.TABBY_WEBHOOK_SECRET ? 'set' : 'MISSING')
  console.log('TABBY_WEBHOOK_HEADER_NAME:', process.env.TABBY_WEBHOOK_HEADER_NAME || 'X-Goldex-Tabby-Auth')

  if (!secretKey || !merchantCode) {
    console.error('\nSet TABBY_SECRET_KEY and TABBY_MERCHANT_CODE in backend/.env')
    process.exit(1)
  }

  const res = await fetch(`${baseUrl}/api/v1/webhooks`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'X-Merchant-Code': merchantCode,
    },
  })
  const body = await res.json().catch(() => null)
  console.log('\nGET /api/v1/webhooks → HTTP', res.status)
  console.log(JSON.stringify(body, null, 2))

  if (res.status === 200 && Array.isArray(body) && body.length === 0) {
    console.log(`
No webhooks registered for this merchant + key type.
→ Run: API_PUBLIC_URL=https://goldex.retailkerala.com node scripts/tabby-register-webhook.js
→ Use the SAME sk_test / sk_live key type as checkout on the website.
`)
  }

  if (res.status === 200 && Array.isArray(body) && body.length > 0) {
    const testOnly = body.every((w) => w.is_test === true)
    const liveOnly = body.every((w) => w.is_test === false)
    if (secretKey.startsWith('sk_test') && testOnly) {
      console.log('\nOK: Test webhook(s) registered (matches sk_test checkout keys).')
    }
    if (secretKey.startsWith('sk_') && !secretKey.startsWith('sk_test') && liveOnly) {
      console.log('\nOK: Live webhook(s) registered (matches live checkout keys).')
    }
    if (secretKey.startsWith('sk_test') && liveOnly) {
      console.log('\nWARN: Only LIVE webhooks listed but you use TEST keys — register again with sk_test.')
    }
  }

  const origin = apiOrigin()
  if (/localhost|127\.0\.0\.1/i.test(origin)) {
    console.log('\nWARN: API_PUBLIC_URL is localhost — Tabby cannot register that URL. Use https://goldex.retailkerala.com')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
