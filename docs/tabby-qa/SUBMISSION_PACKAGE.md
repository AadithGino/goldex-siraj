# Tabby QA — ready-to-send package

**Generated:** 2026-09-28  
**Merchant code:** `tgjllc`  
**Currency / country:** AED · United Arab Emirates  

---

## Attachments to email

1. **`tabby-qa-screenshots.zip`** — 14 PNGs (EN + AR) in `docs/tabby-qa/screenshots/`
2. **`example-checkout-session-body.json`**
3. **`CHECKLIST_SUMMARY.md`** (optional)

Zip command:

```bash
cd docs/tabby-qa/screenshots && zip -r ../tabby-qa-screenshots.zip *.png
```

---

## URLs for Tabby QA

| Role | URL | Status |
|------|-----|--------|
| **Public API** | https://goldex.retailkerala.com/api/v1 | Live (bootstrap OK) |
| **Storefront (Tabby UI)** | **Deploy required** — `https://goldex.retailkerala.com/` returns 404 for the SPA today | Screenshots captured on **local dev** against the **same MongoDB catalog** (`http://localhost:5174` → `http://localhost:4000/api/v1`) |
| **Webhook** | `https://goldex.retailkerala.com/api/v1/webhooks/tabby` | Register in Tabby dashboard |
| **Webhook header** | `X-Goldex-Tabby-Auth: <TABBY_WEBHOOK_SECRET>` | **Set secret on server** (currently missing in deployed env) |

**Before Tabby’s QA session:** deploy the frontend build to `https://goldex.retailkerala.com` (or give Tabby a stable HTTPS preview URL), set `VITE_API_URL=https://goldex.retailkerala.com/api/v1`, and configure on the API host:

- `TABBY_ENABLED=true`, test keys, `TABBY_MERCHANT_CODE=tgjllc`
- `API_PUBLIC_URL=https://goldex.retailkerala.com` (origin only, no `/api/v1`)
- `TABBY_WEBHOOK_SECRET=<strong-random>`

---

## Platform & checkout

- **Website only** (no native apps).
- **Registered customers only** — phone OTP (WhatsApp in production).

### Test accounts (Tabby credentials on staging)

| Purpose | Phone | Email (profile) | Tabby HPP OTP |
|---------|-------|-----------------|---------------|
| Success / cancel / corner | +971500000001 | otp.success@tabby.ai | 8888 |
| Pre-scoring reject | +971500000002 | otp.success@tabby.ai | — |
| HPP rejection | +971500000001 | otp.rejected@tabby.ai | 8888 |

**Goldex login for QA team:** use the phones above on the storefront login screen (OTP via WhatsApp). For internal prep we also seed carts via `node backend/scripts/tabby-qa-prepare.js`.

---

## Scenarios & payment IDs

Complete these on **staging with valid Tabby test keys**, then paste IDs from the [Tabby Merchant Dashboard](https://merchant.tabby.ai/):

| Scenario | Payment ID | Notes |
|----------|------------|--------|
| Success | _PENDING — Tabby API returned 401 with current keys when creating session; refresh keys with Tabby then run `node backend/scripts/tabby-qa-scenarios.js +971500000001`_ | Expect `CLOSED` after capture |
| Pre-scoring reject | N/A | Phone +971500000002 — screenshots **04-en/ar-checkout-tabby-hidden.png** |
| Cancellation | _PENDING manual HPP_ | Screenshot **06-en/ar-cancelled.png** |
| HPP failure | _PENDING_ | `otp.rejected@tabby.ai` — **07-en/ar-failed.png** |
| Corner case | _PENDING_ | Close tab after Tabby success tick |

---

## Screenshots captured (automation)

| File | Content |
|------|---------|
| 01-en/ar-product.png | PDP + Tabby / installment messaging |
| 02-en/ar-cart-or-sidebar.png | Cart |
| 03-en/ar-checkout-tabby.png | Checkout payment step |
| 04-en/ar-checkout-tabby-hidden.png | Pre-scoring reject customer |
| 05-en-success.png | Post-checkout state (HPP auto timed out; shows checkout — re-capture after live success if needed) |
| 06-en/ar-cancelled.png | Cancel messaging |
| 07-en/ar-failed.png | Failure messaging |

Re-capture after deploy: `cd docs/tabby-qa/scripts && node run-capture.mjs`  
Optional: `TABBY_QA_BASE_URL=https://goldex.retailkerala.com node run-capture.mjs`

---

## Refunds

Refunds are initiated from **Goldex admin** (order cancellation and approved returns). The backend calls Tabby’s Refund API; wallet covers any remainder.

---

## Email body

Use **`EMAIL_REPLY_READY.md`** (copy-paste to Mariia).

---

## Blockers to resolve before sending

1. **Tabby API 401** on session create — confirm `sk_test_…` / `pk_test_…` and merchant code `tgjllc` with Tabby.
2. **Deploy storefront** to a public HTTPS URL Tabby can open.
3. **Set `TABBY_WEBHOOK_SECRET`** on production API and register webhook + header in Tabby.
4. **Run 5 HPP scenarios** and fill payment IDs in `TEST_RUN_LOG_FILLED.md`.
5. **Re-shot 05-en-success / add 05-ar-success** after a real successful Tabby payment (optional polish).
