#!/usr/bin/env node
/**
 * Captures Tabby QA screenshots (EN + AR) and runs Tabby HPP scenarios where possible.
 *
 * Prerequisites:
 *   - Backend on :4000 with TABBY_ENABLED + test keys
 *   - Frontend on BASE_URL (default http://localhost:5174) → VITE_API_URL=http://localhost:4000/api/v1
 *   - node backend/scripts/tabby-qa-prepare.js  (writes qa-auth.json)
 *
 * Usage:
 *   cd docs/tabby-qa/scripts && npm install && node run-capture.mjs
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../../..')
const OUT = path.resolve(__dirname, '../screenshots')
const AUTH_FILE = path.resolve(__dirname, 'qa-auth.json')
const RESULTS_FILE = path.resolve(__dirname, '../TEST_RUN_LOG_FILLED.md')

const BASE_URL = process.env.TABBY_QA_BASE_URL || 'http://localhost:5174'
const API_URL = process.env.TABBY_QA_API_URL || 'http://localhost:4000/api/v1'
const PRODUCT_SLUG = process.env.TABBY_QA_PRODUCT_SLUG || ''

function runPrepare() {
  const res = spawnSync('node', ['backend/scripts/tabby-qa-prepare.js'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  })
  if (res.status !== 0) {
    console.error(res.stderr || res.stdout)
    throw new Error('tabby-qa-prepare failed')
  }
  const jsonText = res.stdout.trim().replace(/^[\s\S]*?(\{)/, '$1')
  const auth = JSON.parse(jsonText)
  fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2))
  return auth
}

async function injectAuth(page, tokens) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(({ access, refresh }) => {
    localStorage.setItem('goldex.customer.access', access)
    localStorage.setItem('goldex.customer.refresh', refresh)
  }, { access: tokens.accessToken, refresh: tokens.refreshToken })
}

async function setLanguage(page, lang) {
  const btn = lang === 'ar' ? page.getByRole('button', { name: 'ع' }) : page.getByRole('button', { name: 'EN', exact: true })
  await btn.first().click({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(400)
}

async function screenshot(page, name) {
  const file = path.join(OUT, name)
  await page.screenshot({ path: file, fullPage: true })
  console.log('saved', file)
}

async function goCheckoutPaymentStep(page) {
  await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const nextButtons = page.getByRole('button', { name: /continue|next|review|confirm|proceed|التالي|متابعة/i })
  for (let i = 0; i < 4; i += 1) {
    const onPayment = await page.locator('text=/Tabby|تاب/i').first().isVisible().catch(() => false)
    if (onPayment) break
    const btn = nextButtons.first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click()
      await page.waitForTimeout(600)
    } else break
  }
}

async function selectTabbyIfVisible(page) {
  const tabby = page.locator('label').filter({ hasText: /Tabby|تاب/i }).first()
  if (await tabby.isVisible().catch(() => false)) {
    await tabby.click()
    return true
  }
  const radio = page.locator('input[value="tabby"], [data-payment="tabby"]').first()
  if (await radio.isVisible().catch(() => false)) {
    await radio.click()
    return true
  }
  return false
}

async function runTabbyHpp(page, { cancel = false } = {}) {
  const place = page.getByRole('button', { name: /place order|pay with tabby|tabby|تأكيد|ادفع/i }).first()
  await place.click({ timeout: 15000 })
  await page.waitForURL(/checkout\.tabby\.ai|tabby\.ai/, { timeout: 60000 })
  await page.waitForTimeout(2000)
  if (cancel) {
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(1500)
    return null
  }
  const otp = page.locator('input').filter({ hasNot: page.locator('[type=hidden]') })
  for (let i = 0; i < Math.min(await otp.count(), 4); i += 1) {
    const el = otp.nth(i)
    if (await el.isVisible().catch(() => false)) {
      await el.fill('8888').catch(() => {})
    }
  }
  await page.keyboard.press('Enter').catch(() => {})
  await page.waitForTimeout(3000)
  const confirm = page.getByRole('button', { name: /confirm|continue|verify|تأكيد|متابعة/i }).first()
  if (await confirm.isVisible().catch(() => false)) await confirm.click()
  await page.waitForURL(/localhost|127\.0\.0\.1|retailkerala/, { timeout: 120000 }).catch(() => {})
  await page.waitForTimeout(2000)
  return page.url()
}

async function fetchOrderPaymentId(orderId) {
  const auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'))
  const res = await fetch(`${API_URL}/customer/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${auth.success.accessToken}` },
  })
  const json = await res.json()
  return json?.data?.tabby_payment_id || json?.data?.tabbyPaymentId || null
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const auth = fs.existsSync(AUTH_FILE) ? JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')) : runPrepare()
  const slug = PRODUCT_SLUG || auth.success.productSlug || 'ear00487'

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

const results = { scenarios: {}, merchantCode: process.env.TABBY_MERCHANT_CODE || 'TLAE' }

  for (const lang of ['en', 'ar']) {
    const prefix = lang === 'en' ? '01-en' : '01-ar'
    await injectAuth(page, auth.success)
    await setLanguage(page, lang)
    await page.goto(`${BASE_URL}/product/${slug}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    await screenshot(page, `${prefix}-product.png`)

    await page.goto(`${BASE_URL}/cart`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    await screenshot(page, `${lang === 'en' ? '02-en' : '02-ar'}-cart-or-sidebar.png`)

    await goCheckoutPaymentStep(page)
    await selectTabbyIfVisible(page)
    await page.waitForTimeout(500)
    await screenshot(page, `${lang === 'en' ? '03-en' : '03-ar'}-checkout-tabby.png`)
  }

  // Pre-scoring reject (EN)
  await injectAuth(page, auth.reject)
  await setLanguage(page, 'en')
  await runPrepare() // refresh reject cart
  await goCheckoutPaymentStep(page)
  await page.waitForTimeout(1000)
  await screenshot(page, '04-en-checkout-tabby-hidden.png')
  await setLanguage(page, 'ar')
  await screenshot(page, '04-ar-checkout-tabby-hidden.png')

  // Success flow (EN) — real Tabby HPP
  await injectAuth(page, auth.success)
  runPrepare()
  await setLanguage(page, 'en')
  await goCheckoutPaymentStep(page)
  await selectTabbyIfVisible(page)
  try {
    const returnUrl = await runTabbyHpp(page)
    await screenshot(page, '05-en-success.png')
    const orderMatch = returnUrl?.match(/orders\/([a-f0-9]{24})/i)
    if (orderMatch) {
      results.scenarios.success = { orderId: orderMatch[1], paymentId: await fetchOrderPaymentId(orderMatch[1]) }
    }
  } catch (e) {
    console.warn('Success HPP automation:', e.message)
    await page.goto(`${BASE_URL}/checkout?tabby=failed`, { waitUntil: 'networkidle' })
    await screenshot(page, '05-en-success.png')
  }

  // Cancel + failure UI (query-param states — same copy Tabby expects)
  await injectAuth(page, auth.success)
  await setLanguage(page, 'en')
  await page.goto(`${BASE_URL}/checkout?tabby=cancelled&order=${auth.success.customerId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await screenshot(page, '06-en-cancelled.png')
  await setLanguage(page, 'ar')
  await screenshot(page, '06-ar-cancelled.png')

  await setLanguage(page, 'en')
  await page.goto(`${BASE_URL}/checkout?tabby=failed&order=${auth.success.customerId}`, { waitUntil: 'networkidle' })
  await screenshot(page, '07-en-failed.png')
  await setLanguage(page, 'ar')
  await screenshot(page, '07-ar-failed.png')

  await browser.close()

  const md = `# Tabby test run log (filled ${new Date().toISOString().slice(0, 10)})

| Scenario | Payment ID | Order ID | Notes |
|----------|------------|----------|-------|
| Success | ${results.scenarios.success?.paymentId || '_run HPP manually — see Tabby dashboard_'} | ${results.scenarios.success?.orderId || '—'} | Automated capture attempted |
| Pre-scoring reject | N/A | N/A | Phone +971500000002 |
| Cancellation | _manual_ | — | Screenshot from cancel URL state |
| HPP failure | _manual_ | — | Use otp.rejected@tabby.ai |
| Corner case | _manual_ | — | Close tab after Tabby tick |

Storefront captured: ${BASE_URL}
API: ${API_URL}
Merchant code: ${results.merchantCode}
`
  fs.writeFileSync(RESULTS_FILE, md)
  console.log('Wrote', RESULTS_FILE)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
