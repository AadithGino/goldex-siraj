# Goldex Phase 16–18 Verification

Independent remediation pass against the Zip(4) codebase. Prior Phase 11–15 statuses were re-inspected before changes. Verdict remains **NO-GO**.

| Field | Value |
|---|---|
| Date | 2026-07-20 |
| Workspace | `goldex-production` |
| Release verdict | **NO-GO** |

## Issue register

| Issue ID | Severity | Root cause | Changed files | Invariant | Automated tests | Exact results | Migration | Rollback | Status |
|---|---|---|---|---|---|---|---|---|---|
| P16-QUOTE | Blocker | FE `useCartTotals` divergent VAT/shipping/discount math | `pricing.service.js` (`quoteCustomerCart`), commerce routes/controller, `useCartTotals.js`, CheckoutPage | Checkout totals come only from `POST /customer/cart/quote`; no FE VAT calc | `cart-quote-payment.test.js`, `useCartTotals.test.jsx`, `vat-cart.test.js` | BE quote suite pass; FE hook pass | N/A | Revert quote route + restore old hook | **Verified** (BE+FE quote tests) |
| P16-VAT | Blocker | `making_only` could include zero-rated/exempt making; shipping wrongly in FE VAT base | `cartTotals.js` | Zero-rated/exempt never contribute making VAT; shipping not in line VAT base | `vat-cart` making_only + shipping coupon cases | Pass | N/A | Revert cartTotals | **Verified** |
| P16-PAY | Blocker | `collectPayment` repriced manual_locked orders | `order.service.js` | COD handover live-reprices; manual preserves placement snapshots | `cart-quote-payment.test.js` payment semantics | Pass (manual lock + COD reprice + 24KT zero) | N/A | Revert collectPayment branch | **Verified** |
| P17-STOCK | Blocker | StockMovement unique key blocked sequential updates | `rate.models.js`, `inventory.service.js`, `catalog.service.js`, migrate-indexes | Unique partial `idempotencyKey` per mutation | `stock-idempotency.test.js` | Pass | Index via migrate | Drop key index; restore old index carefully | **Verified** |
| P17-RET | High | Overlapping returns only query-then-insert | `commerce.models.js`, `return.service.js` | Partial unique active cancellation / whole-order return; atomic resolve | `returns.test.js` | Pass | Index via migrate | Drop partial uniques | **Verified** |
| P17-BFR | High | Missing `reservedReturnQty` on legacy items | `scripts/backfill-reserved-return-qty.js`, package.json scripts | Missing → 0; never overwrite; exit 2 on invalid | Script dry-run (not against prod) | Script present | `returns:backfill-reservations:dry` / apply | N/A (additive) | **Implemented** (prod apply pending) |
| P17-OTP | High | Concurrent send could return superseded code; delivery failure cleared other challenges | `auth.service.js` | Active deliverable challenge; delivery fail only clears own `_id`; rate limit insert-then-count | `auth-concurrency.test.js` | Pass | N/A | Revert sendOtp | **Verified** |
| P17-REF | High | Refresh vs logout-all race | `auth.service.js`, refresh session `tokenVersion` | Rotate rejects if generation changed | `auth-concurrency.test.js` | Pass | N/A | Revert rotate | **Verified** |
| P17-SCH | High | Cancelled installment counted as satisfied | `scheme.service.js` | Completion requires every installment `paid` | `scheme.test.js` | Pass | N/A | Revert filter | **Verified** |
| P18-PDF | High | Regex PDF validation accepted fakes | `fileSignature.js` + `pdf-lib` | Real parse; reject fake/encrypted/JS/embed/pages | `file-signature.test.js` | Pass | N/A | Revert util; remove pdf-lib | **Verified** |
| P18-IDX | High | Same-name wrong definition skipped | `migrate-indexes.js`, `health.service.js` | Strict key/unique/partial/TTL match | `migrate-indexes.test.js` | Pass | migrate dry-run | Forward-fix only | **Verified** |
| P18-PAGE | High | Client-side first-page filters | order/admin/inventory services + FE admin hooks | Server filters before pagination; meta consumed | `catalog-aggregate` search outside page 1 | Pass partial | N/A | Revert list helpers | **Implemented** (not every storefront filter UI verified end-to-end) |
| P18-ZOD | High | Incomplete mutation validation | validators + routes (address strip ownership, catalog, scheme, review) | Normalized validated bodies; strip ownership fields | session-address ownership + suite | Pass | N/A | Remove validate wires | **Implemented** |
| P18-HYG | Medium | Archive could include secrets/OS junk | `.gitignore`, docs | Packaging must exclude `.env`, uploads, `.DS_Store`, `__MACOSX` | Hygiene scan (existence + ignore) | `.env` on disk but gitignored; uploads/DS_Store present locally — must exclude from archive | N/A | N/A | **Implemented** (archive packaging gate) |

## Commands recorded (2026-07-20)

```text
cd backend && npm run lint
# clean (exit 0)

cd backend && npm test
# Test Files  25 passed (25)
# Tests       154 passed (154)
# Failed      0
# Skipped     0

cd backend && npm audit
# found 0 vulnerabilities
cd backend && npm audit --omit=dev
# found 0 vulnerabilities

cd frontend && npm run lint
# clean

cd frontend && npm test
# Test Files  11 passed (11)
# Tests       28 passed (28)
# Failed      0
# Skipped     0

cd frontend && npm run build
# exit 0 (Vite 6.4.3)

cd frontend && npm audit
# found 0 vulnerabilities
cd frontend && npm audit --omit=dev
# found 0 vulnerabilities
```

`npm ci` was not re-run in this pass (workspace already installed); use `npm ci` on clean CI agents.

## Migration / backfill commands (do not run on production from Cursor)

```bash
cd backend
npm run migrate:indexes:dry
npm run returns:backfill-reservations:dry
npm run wallet:backfill:dry
npm run coupon:backfill-usage:dry
# Apply only in maintenance window after reconciliation:
# npm run migrate:indexes
# npm run returns:backfill-reservations
# npm run wallet:backfill
# npm run coupon:backfill-usage
```

## Archive hygiene check

| Check | Result |
|---|---|
| `backend/.env` / `frontend/.env` on disk | Present locally (dev) |
| gitignored | Yes (root + backend ignore) |
| Sanitized examples | `backend/.env.example`, `frontend/.env.example` present |
| Local `.DS_Store` | Present under tree — **must exclude from zip** |
| Local `backend/uploads/**` | Present (test artifacts) — **must exclude from zip** |
| `__MACOSX` | Not found in scan |

## Open gates (NO-GO)

1. Production migrate/backfill apply  
2. Credential rotation (`GOLDEX_CREDENTIAL_ROTATION.md`)  
3. Staging manual matrix (COD/manual/VAT UI identity across checkout/detail/invoice)  
4. Clean reviewable archive without `.env` / uploads / `.DS_Store`  
5. Remaining storefront pagination/filter E2E evidence for every catalog surface  

## Dry packaging checklist

Exclude: `.env`, `.env.*` (keep examples), `uploads/`, `node_modules/`, `dist/`, `coverage/`, logs, `.DS_Store`, `__MACOSX/`. Prefer `git archive` or rsync excludes over zipping a dirty tree.
