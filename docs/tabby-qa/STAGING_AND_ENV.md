# Tabby — staging & environment checklist

Complete this **before** QA screenshots and test runs.

## Store facts (for Tabby email)

| Item | Goldex value |
|------|----------------|
| Platform | **Website only** (responsive SPA; no native iOS/Android app) |
| Countries / currency | **UAE**, **AED** |
| Checkout | **Registered customers only** (OTP login); no guest checkout |
| Storefront URL | `https://www.goldexjewellery.ae` |
| Staging API URL | _Fill:_ e.g. `https://goldex.retailkerala.com/api/v1` (must match `VITE_API_URL`) |
| Merchant code(s) | _Fill from Tabby:_ `TABBY_MERCHANT_CODE` |

## Backend `.env` (staging / production)

```env
TABBY_ENABLED=true
TABBY_BASE_URL=https://api.tabby.ai
TABBY_PUBLIC_KEY=pk_test_…          # or pk_live_… after go-live
TABBY_SECRET_KEY=sk_test_…
TABBY_MERCHANT_CODE=…
TABBY_WEBHOOK_HEADER_NAME=X-Goldex-Tabby-Auth
TABBY_WEBHOOK_SECRET=<long-random-secret>
API_PUBLIC_URL=https://<public-api-host>   # HTTPS origin only (no /api/v1 path)
CLIENT_ORIGINS=https://<storefront-host>
ONLINE_PAYMENT_PROVIDER=auto              # or tabby
```

## Frontend `.env` (staging build)

```env
VITE_API_URL=https://<public-api-host>/api/v1
```

Bootstrap must expose `tabby_configured: true` and `online_checkout_enabled: true` (requires backend Tabby keys + store settings).

## Tabby Merchant Dashboard

1. Register webhook **POST** `{API_PUBLIC_URL}/api/v1/webhooks/tabby`
2. Set custom header name + value matching `TABBY_WEBHOOK_HEADER_NAME` / `TABBY_WEBHOOK_SECRET`
3. Confirm merchant code matches `TABBY_MERCHANT_CODE`

## Test account for Tabby QA team

Create a dedicated customer on staging (phone OTP in dev may show `test_otp` if `SHOW_TEST_OTP=true` **only on non-production**):

| Field | _Fill before send_ |
|-------|---------------------|
| Phone | e.g. +97150… |
| Login | OTP via WhatsApp/SMS per your OTP provider |
| Saved address | Complete UAE address (required for Tabby) |

Share credentials with Tabby in the email (not in git).

## Pre-flight script

From repo root:

```bash
node backend/scripts/tabby-qa-preflight.js
```

Fix any `[FAIL]` lines before testing.
