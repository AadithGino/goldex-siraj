#!/usr/bin/env node
/**
 * Register (or list) Tabby webhooks using your .env keys.
 * The webhook "secret" is a value YOU choose — Tabby does not issue one.
 *
 *   node backend/scripts/tabby-register-webhook.js
 *   node backend/scripts/tabby-register-webhook.js --list
 *
 * Add to backend/.env (same value as registered header):
 *   TABBY_WEBHOOK_HEADER_NAME=X-Goldex-Tabby-Auth
 *   TABBY_WEBHOOK_SECRET=<the value you pass as header.value>
 */
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env'), quiet: true })

const baseUrl = (process.env.TABBY_BASE_URL || 'https://api.tabby.ai').replace(/\/+$/, '')
const secretKey = process.env.TABBY_SECRET_KEY
const merchantCode = process.env.TABBY_MERCHANT_CODE
const headerName = process.env.TABBY_WEBHOOK_HEADER_NAME || 'X-Goldex-Tabby-Auth'
const webhookSecret = process.env.TABBY_WEBHOOK_SECRET || crypto.randomBytes(24).toString('hex')
function resolveWebhookApiOrigin() {
  const raw = (process.env.TABBY_WEBHOOK_URL || process.env.API_PUBLIC_URL || 'https://goldex.retailkerala.com')
    .replace(/\/+$/, '')
    .replace(/\/api\/v1$/i, '')
  if (/localhost|127\.0\.0\.1/i.test(raw)) {
    throw new Error(
      'Webhook URL must be public HTTPS. Set API_PUBLIC_URL=https://goldex.retailkerala.com (or TABBY_WEBHOOK_URL) — not localhost.',
    )
  }
  return raw
}

const apiOrigin = resolveWebhookApiOrigin()
const webhookUrl = `${apiOrigin}/api/v1/webhooks/tabby`

function headers() {
  if (!secretKey || !merchantCode) {
    throw new Error('Set TABBY_SECRET_KEY and TABBY_MERCHANT_CODE in backend/.env')
  }
  return {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
    'X-Merchant-Code': merchantCode,
  }
}

async function listWebhooks() {
  const res = await fetch(`${baseUrl}/api/v1/webhooks`, { headers: headers() })
  const body = await res.json().catch(() => null)
  console.log('GET /api/v1/webhooks', res.status, JSON.stringify(body, null, 2))
}

async function registerWebhook() {
  console.log('Registering webhook:', webhookUrl)
  const payload = {
    url: webhookUrl,
    header: { title: headerName, value: webhookSecret },
  }
  const res = await fetch(`${baseUrl}/api/v1/webhooks`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => null)
  console.log('POST /api/v1/webhooks', res.status, JSON.stringify(body, null, 2))
  if (!res.ok) process.exit(1)
  console.log('\nAdd these to backend/.env (and production secrets):\n')
  console.log(`TABBY_WEBHOOK_HEADER_NAME=${headerName}`)
  console.log(`TABBY_WEBHOOK_SECRET=${webhookSecret}`)
  console.log(`\nWebhook URL: ${webhookUrl}`)
}

const list = process.argv.includes('--list')
list ? listWebhooks().catch(console.error) : registerWebhook().catch(console.error)
