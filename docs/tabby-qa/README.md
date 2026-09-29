# Tabby QA submission package (Goldex)

Everything Tabby asked for in their integration email, prepared in one place.

| File | Purpose |
|------|---------|
| [EMAIL_REPLY_DRAFT.md](./EMAIL_REPLY_DRAFT.md) | Copy-paste email to Tabby (fill `_FILL_` fields) |
| [CHECKLIST_SUMMARY.md](./CHECKLIST_SUMMARY.md) | Four checklist areas — implemented / N/A / ops |
| [STAGING_AND_ENV.md](./STAGING_AND_ENV.md) | Env vars, webhook URL, test account template |
| [TEST_RUN_LOG.md](./TEST_RUN_LOG.md) | Table for payment IDs after staging test runs |
| [SCREENSHOTS.md](./SCREENSHOTS.md) | Required screenshots (EN + AR) |
| [example-checkout-session-body.json](./example-checkout-session-body.json) | Sanitized `POST /api/v2/checkout` example |
| [screenshots/](./screenshots/) | Drop PNGs here, then zip for email |

## What you still need to do manually

1. **Staging** — Set Tabby test keys + `API_PUBLIC_URL` on the public API host (see `STAGING_AND_ENV.md`). Local `.env` currently has **no `TABBY_*` vars**; QA must run on staging, not localhost-only.
2. **Run 5–6 test scenarios** — Use [Tabby testing credentials](https://docs.tabby.ai/testing-guidelines/testing-credentials) (OTP **8888**). Log payment IDs in `TEST_RUN_LOG.md`.
3. **Screenshots** — Follow `SCREENSHOTS.md`, save under `screenshots/`, zip.
4. **Test customer account** — Create on staging; add credentials to the email draft (do not commit passwords/OTPs).
5. **Merchant code & staging URL** — Confirm with whoever owns the Tabby merchant account; paste into email draft.

## Quick commands

```bash
# Config sanity (no secrets printed)
node backend/scripts/tabby-qa-preflight.js

# Backend unit tests for Tabby flow
cd backend && npm test -- --run test/tabby.test.js

# Zip screenshots for email
cd docs/tabby-qa/screenshots && zip -r ../tabby-qa-screenshots.zip .
```

## Official Tabby links

- [Full testing checklist](https://docs.tabby.ai/pay-in-4-custom-integration/full-testing-checklist)
- [Testing credentials](https://docs.tabby.ai/testing-guidelines/testing-credentials)
