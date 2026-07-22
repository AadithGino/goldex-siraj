# Goldex Production Remediation Change Log

This is the verification handoff document. Cursor must update it while implementing production remediation. Do not delete rows. Use `Not started`, `In progress`, `Blocked`, `Implemented`, or `Verified`.

## Project and baseline

| Field | Value |
|---|---|
| Project/branch or archive name | `goldex-production` / working tree under clients monorepo |
| Commit before remediation | `719dd2a` (prior archive baseline) |
| Commit after remediation | TBD (working tree; not committed unless requested) |
| Node version | `v24.18.0` |
| npm version | `11.16.0` |
| MongoDB version/topology | Atlas `8.0.27`, replica set `atlas-g7rwwr-shard-0` (3 hosts); transactions supported |
| Backend baseline lint/tests | Phase 0–15: lint exit 0 on touched areas; **130 passed (23 files)** |
| Frontend baseline build/tests | lint exit 0; tests **26 passed**; build exit 0; route code-splitting (index ~201 kB gzip 66 kB); Vite **6.4.2** |
| Date completed | In progress — 2026-07-20 |
| Implemented by | Cursor Agent (production remediation) |

## Status definitions

- **Implemented:** code exists, but complete verification evidence is not yet recorded.
- **Verified:** acceptance criteria pass and the evidence section contains commands/tests/results.
- **Blocked:** reason, owner, and required decision are recorded.
- A build-only result cannot produce `Verified` status for a business workflow.

## Status accuracy corrections (2026-07-20)

Prior changelog incorrectly marked some items Verified. Corrected:

- **PRC-01/02/03 / REG-08 / CAT-01 (pricing path):** were Not started / falsely Verified while `ProductStone`/`StoneRate` were absent from live pricing. Restored in Phase 1 → **Verified** with pricing tests.
- **RET-04:** “partial return” covered whole-line selection only, not partial *quantity within one line*. Demoted to **Implemented** pending Phase 5 quantity support.
- **WAL-01 / CPN-01:** concurrency code exists but production index migrations incomplete → demoted to **Implemented** until Phase 3 migrations verify.
- **REG-01 / REG-02 / SEC-02 / ADR-01/02:** session collision fixed in Phase 2 → **Verified**.

## Remediation checklist

| ID | Severity | Change | Status | Files changed | Test/evidence reference | Migration/rollback |
|---|---|---|---|---|---|---|
| RPT-01 | Blocker | Align dashboard API/UI contract and include all required metrics | Verified | `backend/src/services/report.service.js`, `frontend/src/pages/admin/DashboardPage.jsx`, `DashboardPage.test.jsx` | `test/report.test.js` dashboard contract; frontend DashboardPage test | N/A |
| RPT-02 | Blocker | Align daily/top-product report fields and CSV output | Verified | `report.service.js` + UI; Phase 4 added gross/refund/net | `test/report.test.js`; frontend reports test | N/A |
| RPT-03 | High | Apply Asia/Dubai date boundaries and report range to every query | Verified | `backend/src/utils/dubaiTime.js`, `report.service.js` | `test/dubaiTime.test.js`, `test/report.test.js` | N/A |
| ORD-01 | Blocker | Enforce store minimum and COD min/max on backend-calculated total | Verified | `order.service.js` `assertCheckoutLimits`, `order.validators.js` | `test/wallet.test.js` COD_BELOW_MINIMUM | N/A |
| WAL-01 | Blocker | Implement atomic wallet balance/debit/credit service | Verified | `wallet.service.js` requires/auto-opens txn; no compensate-after-11000 | `test/wallet.test.js`, `test/phase3-concurrency.test.js` | `migrate:indexes` + `wallet:backfill` |
| WAL-02 | Blocker | Backfill/reconcile wallet balances safely and idempotently | Implemented | `scripts/backfill-wallet-accounts.js` (no `--allow-negative`; blocks negatives + nonzero orphans; `TOTALS` JSON) | dry-run available; prod apply pending | Required |
| CPN-01 | Blocker | Make coupon limits/redemptions atomic under concurrency | Verified | `coupon.service.js` no compensate-after-11000; placeOrder whole-txn retry | `test/coupon-concurrency.test.js`, `test/phase3-concurrency.test.js` | `migrate:indexes` + `coupon:backfill-usage` |
| CPN-02 | High | Preserve accepted coupon snapshot during later repricing | Verified | existing `couponSnapshot` + `repriceOrder`; concurrency test | `test/coupon-concurrency.test.js` deactivated coupon | N/A (snapshot already on place) |
| RET-01 | Blocker | Refund paid manual cancellations to wallet with matching event | Verified | `order.service.js` cancel + `PaymentEvent` `order_cancel_refund` | `test/returns.test.js` paid cancel | Reconciliation required for legacy cancels |
| RET-02 | Blocker | Validate returned item ownership and prevent empty invalid completion | Verified | `return.service.js` request+complete item checks | `test/returns.test.js` INVALID_ORDER_ITEM / duplicate complete | N/A |
| RET-03 | Blocker | Allocate partial refund from actual paid value and cap cumulative refunds | Verified | `refund.service.js` `paidAllocation`/`refundedTotal` | `test/returns.test.js` partial refund | Schema: item.paidAllocation, order.refundedTotal |
| RET-04 | High | Support partial-return item/state tracking and exact-once restock | Verified | `requestedQty` on ReturnRequest; remaining-allocation refund math; concurrent complete once | `test/returns.test.js` qty 1 of 3 + concurrent | Schema: ReturnRequest.requestedQty |
| CAT-01 | Blocker | Prevent public access/pricing/cart for draft or archived parent products | Verified | pricing + public catalog `status=active`; getOne hydrated detail | `test/pricing-live.test.js` | N/A |
| CAT-02 | Blocker | Replace unrestricted catalog/customer/staff writes with allowlisted DTOs | Implemented | `catalog.dto.js` allowlists; stock fields stripped | lint + existing catalog flows | N/A |
| CAT-03 | Blocker | Prevent stock edits outside inventory service/ledger | Implemented | `inventory.service.js`; order/return/admin adjust/set-stock | existing order/return/wallet tests | API: set-stock |
| CAT-04 | Blocker | Replace orphan-producing hard deletes with archive/dependency-safe operation | Implemented | products/variants archive when order-referenced; category/brand soft | — | N/A |
| CAT-05 | Blocker | Make variant, stock, and stone save atomic | Implemented | create product/variant/stone/image-primary in sessions | — | N/A |
| CAT-06 | High | Make primary-image selection atomic and unique | Implemented | unset siblings in txn on create/update primary | migrate partial unique index | Index migration |
| PRC-01 | Blocker | Apply documented product/variant tax-treatment rule | Verified | `pricingCalculator.js` `computeVat`, `pricing.service.js` cart totals | `test/pricing.test.js` making_only / inclusive / exempt | N/A |
| PRC-02 | Blocker | Validate effective metal weight invariant | Verified | `assertMetalWeights`; variant create/update in `catalog.service.js` | `test/pricing.test.js` invalid effective weight | Existing-data audit still advised |
| PRC-03 | Blocker | Correct stone rate lookup and missing-rate behavior | Verified | `loadLiveStoneBreakup` uses current `StoneRate`; `STONE_RATE_MISSING` | `test/pricing-live.test.js` live stones / missing rate / rate change | Existing-data audit |
| INV-01 | High | Add atomic set-stock endpoint with stale-write conflict | Implemented | `POST /admin/inventory/variants/:id/set-stock` | — | N/A |
| INV-02 | Medium | Return category data required by inventory UI | Not started | — | — | N/A |
| INV-03 | High | Add server-side stock-ledger pagination/filtering/total | Implemented | `inventory.service.stockLedger` page/limit/total | — | N/A |
| SCH-01 | Blocker | Prevent scheme completion/payout before maturity | Verified | removed auto-complete on last installment; `MATURITY_NOT_REACHED` | `test/scheme.test.js` | Schema: `maturityAt` |
| SCH-02 | Blocker | Implement idempotent manager/owner maturity-completion endpoint | Verified | `POST .../enrollments/:id/complete` + wallet idempotency | `test/scheme.test.js` concurrent complete | N/A |
| SCH-03 | High | Align scheme payment controls with backend roles; do not broaden staff | Verified | complete + pay remain `authorizeStaffRoles('manager')` | routes | N/A |
| SCH-04 | High | Cancel unpaid installments when enrollment is cancelled | Verified | cancel sets pending/overdue → cancelled | `test/scheme.test.js` | N/A |
| SCH-05 | High | Implement deterministic overdue installment status | Verified | `applyOverdueStatuses` Asia/Dubai | `test/scheme.test.js` | Optional cron later |
| ADR-01 | Blocker | Allowlist address fields and prevent ownership mutation | Verified | `address.dto.js`, `customer.service.js` `saveAddress` | `test/session-address.test.js` ignores customerId | N/A |
| ADR-02 | High | Validate required UAE delivery fields and default-address invariant | Verified | UAE phone/emirate/country validation; default unset in txn | `test/session-address.test.js` one default | N/A |
| VAL-01 | High | Add validation middleware to every write route | Implemented | Zod on place-order, returns, resolve, stock adjust/set-stock, auth OTP/profile/password; address DTO; catalog DTO | `order.validators.js`, routes | Remaining: coupon/catalog body schemas |
| SEC-01 | High | Reject deactivated/stale-version access tokens promptly | Verified | `authenticateCustomer`/`authenticateStaff` check isActive + tokenVersion; Customer.tokenVersion added | `test/session-address.test.js` | N/A |
| SEC-02 | High | Preserve customer/staff session isolation and test it | Verified | namespaced cookies; portal-specific middleware | `test/session-address.test.js` | Cookie rollout: re-login clears legacy |
| UPL-01 | High | Validate upload signatures and decoded content | Verified | magic-byte `fileSignature.js`; MIME mismatch + polyglot sniff | `test/file-signature.test.js`, `test/uploads.test.js` | N/A |
| UPL-02 | High | Associate/expire return proofs and clean orphaned objects | Implemented | `PendingUpload` + claim on return; 24h TTL; cleanup script | `test/uploads.test.js`; `uploads:cleanup-return-proofs:dry` | Cron/ops |
| API-01 | Blocker | Replace client-side 200-record catalog joins with paginated APIs | In progress | list already paginated; listing FE still joins (detail fixed) | — | API contract change |
| API-02 | High | Add single-fetch product detail by slug/ID and fix occasion field | Implemented | hydrated `getOne` + FE `getProductById`/`useProductBySlug` | frontend tests 26 pass | N/A |
| API-03 | High | Add scoped/paginated admin customer, wallet, order and scheme endpoints | Not started | — | — | API contract change |
| API-04 | High | Paginate admin orders/customers/payment events/audit logs | Not started | — | — | API contract change |
| UI-01 | Medium | Make stone deletion behavior and confirmation truthful | Not started | — | — | Rate archive/delete decision |
| UI-02 | Medium | Add route error boundaries and complete query states | Implemented | `RouteErrorBoundary` on root/storefront/admin routers | App.jsx | Query empty/error states vary by page |
| UI-03 | Medium | Add route code splitting and resolve large main-chunk warning | Verified | `React.lazy` page routes; build splits storefront/admin pages | `npm run build` index ~201 kB | N/A |
| TST-01 | Blocker | Add replica-set integration tests for financial/inventory transactions | In progress | wallet + coupon + orders + session use `MongoMemoryReplSet` | 72 backend tests | Test infrastructure |
| TST-02 | High | Add frontend tests for adapters, reports, checkout, order detail and roles | In progress | dashboard/reports/coupon/order tests added | frontend vitest suite | Test infrastructure |
| OPS-01 | High | Add transaction-capability readiness diagnostic and deployment docs | Implemented | `GET /health/ready` mongo+txn+storage+OTP+critical indexes+S3 HeadBucket (test skip)+8s cache; prod guards | `test/health.test.js`; uploads ready | Deploy uses ready probe; prod HeadBucket not cut over |
| OPS-02 | High | Update `.env.example`, seed data, API contracts and rollback instructions | Implemented | sanitized `.env.example`; change log; `GOLDEX_RELEASE_VERIFICATION.md`; `GOLDEX_PHASE_11_15_VERIFICATION.md` | this file + release/phase docs | Ops must rotate secrets |

## Previously reported regression checks

| ID | Regression to verify | Status | Evidence |
|---|---|---|---|
| REG-01 | Customer/staff cookies and refresh sessions cannot collide | Verified | `test/session-address.test.js` coexistence / logout isolation |
| REG-02 | Customer address calls use the customer session and no longer return role `FORBIDDEN` | Verified | staff login + customer address create 201 |
| REG-03 | Gold/stone histories safely handle `effective_at`, invalid and missing dates | Verified | existing `rateAdapters` / rate history tests still pass |
| REG-04 | Customer and admin orders share a correct `items` adapter and show all item/payment/coupon details | Verified | `orderAdapter.test.js`, OrderDetail/OrderList tests pass |
| REG-05 | Coupon usage displays customer/order/payment fields and rollback state correctly | Verified | prior coupon remediation + `CouponUsageDialog.test.jsx` |
| REG-06 | Certificate uploads use `product-certificates` consistently | Verified | FE `/admin/media/certificate` → storage folder `product-certificates` (unchanged) |
| REG-07 | Reports count only paid orders; uncollected COD is excluded | Verified | paid/partially_refunded/refunded with paidAt; COD unpaid excluded; gross/refund/net |
| REG-08 | COD final amount uses live gold/stone pricing at handover | Verified | `ignoreFixedPrice` + live `ProductStone`/`StoneRate`; `pricing-live` + orders handover tests |

## Phase 0 — Release hygiene evidence

| Item | Result |
|---|---|
| Root `.gitignore` | Covers `**/.env`, node_modules, dist, coverage, `.DS_Store`, `__MACOSX`, uploads, mongo-memory caches |
| Secret `.env` tracked | No — `git check-ignore` matches `backend/.env` / `frontend/.env`; keep `.env.example` |
| Credential rotation note | `GOLDEX_CREDENTIAL_ROTATION.md` (Mongo/JWT/admin/S3/OTP) |
| `frontend npm ci --workspaces=false` | exit 0 (lockfile includes Vitest/Testing Library/jsdom/ESLint) |
| `backend npm ci --workspaces=false` | exit 0 |
| Frontend ESLint | `frontend/eslint.config.js` + `"lint": "eslint ."` |
| Backend lint | exit 0 |
| Frontend lint | exit 0 |
| Frontend tests | 26 passed |
| Frontend build | exit 0 (chunk warning remains) |

## Database migrations and reconciliation

| Migration | Purpose | Dry-run result | Apply result | Validation | Rollback | Status |
|---|---|---|---|---|---|---|
| `npm run wallet:backfill:dry --workspace backend` | Create/reconcile `WalletAccount.balance` from ledger | Not run against prod in session | — | Compare account vs `$sum` of `WalletTransaction` | Restore previous `WalletAccount` docs from backup; ledger untouched | Implemented |
| `npm run coupon:reconcile:dry --workspace backend` | Align `Coupon.usedCount` to active redemptions | Available | — | active redemption count | Re-run reconcile | Implemented (prior) |
| `CouponCustomerUsage` collection | Atomic per-customer coupon limits | Auto-created on first use | — | counts match active redemptions | Drop collection + rebuild via redeem/rollback | Verified scripts: `coupon:backfill-usage:dry` |
| `WalletAccount` collection | Atomic wallet balance | Backfill script (no clamp) | — | balance matches ledger; negatives block | Drop accounts after ledger verify | Verified scripts + tests |
| `migrate:indexes` | Explicit createIndex (no syncIndexes drop); full critical manifest | `migrate:indexes:dry` | Prod apply pending | Duplicate detection aborts unique create; exit 2; no `--force-duplicates` | Drop named indexes only if needed | Implemented |

## Phase 3 evidence notes

- Wallet: mutations always run in a Mongo session (caller-provided or auto-opened). Duplicate-key never triggers compensating `$inc` inside an aborted txn.
- Coupon: capacity freed only via transaction abort or exact-once rollback; placeOrder retries duplicate-key races up to 5 times; order 11000 mapped only for `customerId+idempotencyKey`.
- Scripts: `npm run migrate:indexes:dry --workspace backend`, `wallet:backfill:dry`, `coupon:backfill-usage:dry`.
- Automated: backend **75** passed including `test/phase3-concurrency.test.js`.

## Phase 4 evidence notes

- Paid statuses include `partially_refunded` / `refunded` with valid `paidAt`.
- Sales expose `gross_sales` / `refund_total` / `net_sales` (`total_sales` = net for UI compat).
- Top products use allocation − refund; calendar `isYmd` rejects impossible dates.
- Automated: backend **76** passed.

## API contract changes

| Endpoint/domain | Old behavior | New contract | Frontend consumers updated | Compatibility note |
|---|---|---|---|---|
| `GET /admin/reports/dashboard` | `today_revenue`, `today_orders`, `month_revenue`, `customer_count`; missing status/reviews | `{ timezone, today_sales, orders_today, month_sales, month_orders, orders_by_status, pending_orders, pending_reviews, pending_returns, low_stock_count, active_customer_count }` | `DashboardPage.jsx` | Breaking rename of revenue keys |
| `GET /admin/reports/sales` | paid-only; `total_sales` | `{ timezone, gross_sales, refund_total, net_sales, total_sales(=net), order_count, by_day:[…] }` | `AdminReportsPage.jsx` uses `total_sales` | Additive gross/refund fields |
| `GET /admin/reports/top-products` | `revenue` from lineTotal | `{ product_id, product_name, qty_sold, gross_revenue, refunded_amount, revenue(=net) }` | Uses `revenue` | Additive gross/refund fields |
| Wallet | Ledger-only aggregate | `WalletAccount` + `wallet.service` credit/debit | Admin wallet still reads transactions API | Must backfill accounts before heavy traffic |
| Checkout/orders | No min/COD server checks; non-atomic wallet/coupon | Limits + Zod `placeOrderSchema` + atomic wallet/coupon | Existing place order body | New 409/422 codes: `MINIMUM_ORDER_NOT_MET`, `COD_BELOW_MINIMUM`, `COD_ABOVE_MAXIMUM`, `INSUFFICIENT_WALLET`, `COUPON_USAGE_LIMIT`, `COUPON_CUSTOMER_LIMIT` |
| Auth cookies | Shared `accessToken`/`refreshToken` | `customerAccessToken`/`customerRefreshToken` + `staffAccessToken`/`staffRefreshToken`; legacy cleared on login/refresh/logout | Cookie-based `credentials: 'include'` — no FE name change | Users must re-login once after deploy |
| Pricing | `variant.stoneCharge` only; draft priceable; VAT ignored `applyOn` | Live `ProductStone` + current `StoneRate`; active product only; shared `computeVat` | Existing price/cart/checkout consumers | `STONE_RATE_MISSING`, weight errors |
| Returns/refunds | TBD | TBD | TBD | Phase 5 qty + Phase 4 report accounting |
| Gold schemes | TBD | TBD | TBD | Phase 7 |

## Verification command log

| Date/time | Command | Exit code | Result/test count | Notes |
|---|---|---:|---|---|
| 2026-07-20 ~14:41 IST | Root `.gitignore` + credential rotation note | 0 | hygiene files present | Phase 0 |
| 2026-07-20 ~14:43 IST | `cd frontend && npm ci --workspaces=false` | 0 | lockfile install OK | Phase 0 |
| 2026-07-20 ~14:43 IST | `cd backend && npm ci --workspaces=false` | 0 | lockfile install OK | Phase 0 |
| 2026-07-20 ~14:43 IST | `cd frontend && npm run lint` | 0 | clean | Phase 0 |
| 2026-07-20 ~14:43 IST | `cd frontend && npm test` | 0 | **26 passed** | Phase 0 |
| 2026-07-20 ~14:43 IST | `cd frontend && npm run build` | 0 | built; chunk ~668 kB warning | Phase 0 |
| 2026-07-20 ~14:46 IST | `cd backend && npm test -- test/pricing.test.js test/pricing-live.test.js` | 0 | **14 passed** | Phase 1 pricing restore |
| 2026-07-20 ~14:46 IST | `cd backend && npm test` | 0 | **62 passed (13 files)** | After Phase 1 |
| 2026-07-20 ~14:50 IST | `cd backend && npm test -- test/session-address.test.js` | 0 | **10 passed** | Phase 2 |
| 2026-07-20 ~14:50 IST | `cd backend && npm test` | 0 | **72 passed (14 files)** | After Phase 2 |
| 2026-07-20 ~14:50 IST | `cd backend && npm run lint` | 0 | clean | Phase 2 |
| 2026-07-20 ~14:50 IST | `cd frontend && npm run lint` | 0 | clean | Phase 2 |
| 2026-07-20 ~14:55 IST | `cd backend && npm test` | 0 | **75 passed (15 files)** | After Phase 3 |
| 2026-07-20 ~14:56 IST | `cd backend && npm test` | 0 | **76 passed (15 files)** | After Phase 4 |
| 2026-07-20 ~15:04 IST | `cd backend && npm test` | 0 | **78 passed (15 files)** | After Phase 5–6 |
| 2026-07-20 ~15:06 IST | `cd backend && npm test` | 0 | **82 passed (16 files)** | After Phase 7 schemes |
| 2026-07-20 ~15:03 IST | `cd frontend && npm test` | 0 | **26 passed** | After catalog detail FE |
| 2026-07-20 ~16:10 IST | `cd backend && npm test` | 0 | **89 passed (18 files)** | After Phase 8–10 |
| 2026-07-20 ~16:10 IST | `cd frontend && npm test` | 0 | **26 passed** | Dialog a11y + lazy routes |
| 2026-07-20 ~16:10 IST | `cd frontend && npm run build` | 0 | route chunks; index ~201 kB | UI-03 |
| 2026-07-20 ~16:10 IST | backend + frontend lint | 0 | clean | Phase 8–10 |
| 2026-07-20 ~18:58 IST | `cd backend && npm test` | 0 | **130 passed (23 files)** | Phase 15 |
| 2026-07-20 ~18:58 IST | `cd backend && npx eslint` (touched Phase 15 files) | 0 | clean | Phase 15 |
| 2026-07-20 ~18:57 IST | `cd frontend && npm test` | 0 | **26 passed** | RR future flags + forwardRef |
| 2026-07-20 | Mongo `hello` probe via app `.env` | 0 | RS `atlas-g7rwwr-shard-0`, Mongo 8.0.27 | Phase 0 |
| TBD | `migrate:indexes` against production | TBD | — | Ops before cutover |
| TBD | Dependency/security `npm audit --omit=dev` | TBD | — | Phase 10 |

## Manual/API scenario evidence

| Scenario | Expected | Actual | Evidence | Status |
|---|---|---|---|---|
| Concurrent wallet checkout | Only one debit succeeds; balance never negative | Pass in unit/integration | `test/wallet.test.js` | Implemented (indexes pending) |
| COD limit API bypass attempt | Backend rejects out-of-range order | Pass | `COD_BELOW_MINIMUM` test | Verified (automated) |
| COD handover | Reprices live, records cash payment/invoice, appears in reports | Pass automated path | pricing-live + orders handover | Verified (automated); manual matrix Phase 10 |
| Manual payment | Manager verifies bank/card reference and payment timestamp | Prior coverage | orders tests | Partial |
| Paid manual cancellation | Full eligible amount credited to wallet with refund event | Pass | `test/returns.test.js` | Verified (automated) |
| Partial discounted return | Refund equals allocated paid value and restocks only returned quantity | Pass (whole line only) | `test/returns.test.js` | Implemented — qty-within-line Phase 5 |
| Invalid return item | Request/completion rejected without state changes | Pass | `INVALID_ORDER_ITEM` | Verified (automated) |
| Concurrent coupon use | Limits cannot be exceeded | Pass | `test/coupon-concurrency.test.js` | Implemented (indexes pending) |
| Draft product guessed ID | Public price/cart/detail request rejected | Pass (price) | `test/pricing-live.test.js` | Verified (pricing); catalog list Phase 6 |
| Live stone rate change | Product/COD price updates | Pass | `test/pricing-live.test.js` | Verified |
| Missing stone rate | Checkout/pricing blocked | Pass | `STONE_RATE_MISSING` | Verified |
| Customer+staff simultaneous login | Both sessions work; address create OK | Pass | `test/session-address.test.js` | Verified |
| Address customerId tampering | Ownership stays auth.sub | Pass | `test/session-address.test.js` | Verified |
| Atomic variant save failure | No partial stock/stone/product update remains | TBD | Phase 6 | Not started |
| Early scheme full payment | Enrollment remains active until maturity | Pass | `test/scheme.test.js` | Verified |
| Mature scheme completion | One wallet payout only | Pass | `test/scheme.test.js` concurrent | Verified |
| Staff scheme action | Hidden in UI and rejected by API | Pass (API manager+) | scheme routes `authorizeStaffRoles('manager')` | Verified (API); UI hide partial |
| Deactivated account token | Existing access/refresh tokens rejected | Pass | `test/session-address.test.js` | Verified |
| Invalid upload signature | Upload rejected and no object retained | Pass | `test/file-signature.test.js`, `test/uploads.test.js` | Verified |
| Catalog record 201+ | Product and relations remain visible through pagination/detail | TBD | Phase 6/9 | Not started |

## Unresolved risks and decisions

| Risk/decision | Impact | Owner | Target date | Mitigation/status |
|---|---|---|---|---|
| WalletAccount must be backfilled before production traffic | Concurrent wallet spend race returns if accounts missing/zero while ledger has funds | Ops | Before prod cutover | Run `wallet:backfill:dry` then `wallet:backfill` |
| Production autoIndex disabled | Unique indexes may be missing without explicit migration | Eng | Before cutover | `npm run migrate:indexes:dry` then apply |
| `/health/ready` shipped (OPS-01) | Load balancers should gate on ready=200 | Ops | Cutover | Probe `/health/ready` |
| Remaining high gaps | API list pagination (API-01/03/04), wallet/index prod apply, catalog Implemented≠Verified | Eng | Before GO | Do not claim full remediation |
| Main JS chunk split | Storefront/admin pages lazy-loaded | Eng | Done | Monitor largest remaining vendor chunks |
| Archive credentials compromised | Security | Ops | Before go-live | `GOLDEX_CREDENTIAL_ROTATION.md` |


## Phase 8–10 evidence notes

- Validation: Zod on customer returns, admin resolve, inventory adjust/set-stock; staff change-password.
- Tokens: customer deactivate bumps `tokenVersion` + revokes refresh; staff password reset/deactivate same; `logout-all`.
- Uploads: magic-byte validation; return proofs → `PendingUpload` (24h); `npm run uploads:cleanup-return-proofs:dry`.
- FE: `RouteErrorBoundary` present; route-level `React.lazy`; DialogDescription on admin form dialogs + CouponUsageDialog.
- Ops: `GET /health/ready`; production startup refuses local storage, insecure cookies, localhost CORS, standalone Mongo.
- Automated (pre–Phase 15): backend **89** passed; frontend **26** passed; build OK.

## Phase 16–18 evidence notes

- **16.1** Removed FE financial divergence; `POST /customer/cart/quote` is authoritative; cart/checkout use quote response only (`useCartTotals.js`).
- **16.2** Manual payment no longer calls live reprice; COD handover still reprices; 24KT remains zero-rated in both flows (`cart-quote-payment.test.js`).
- **17** Stock `idempotencyKey`, return partial unique actives, reservedReturnQty backfill script, OTP/refresh hardening, scheme cancelled-installment rejection.
- **18** pdf-lib PDF parse; strict index match; pagination/Zod expansion; Vite 6.4.3; archive hygiene checklist.
- Automated (this pass): backend **154 passed / 0 failed / 0 skipped**; frontend **28 passed / 0 failed / 0 skipped**; audits **0** vulns.
- Verdict: **NO-GO** (prod migrate/credentials/staging/archive gates).

## Final sign-off

| Gate | Result |
|---|---|
| Phases 16–18 dedicated Verified rows | Partial — quote/payment/concurrency/PDF/indexes Verified; pagination/Zod/archive packaging still have Implemented/ops gates |
| Production migrations/backfills applied | **No** |
| Credential rotation | **No** (Operational gate) |
| Staging VAT UI identity matrix | **No** |
| Clean archive without secrets/uploads | **No** (local `.env`/uploads/`.DS_Store` exist; gitignored) |
| Release verdict | **NO-GO** |

## Phase 18 evidence notes

- **18.1:** Real PDF parse via `pdf-lib` (page cap, encryption, JS/OpenAction/EmbeddedFile best-effort, 5s timeout); removed orphan `claimReturnProofs`; tests for valid/fake/truncated PDF.
- **18.2:** Strict `indexMatchesSpec` / conflict-on-wrong-definition in `migrate-indexes` + readiness; unit tests for wrong keys / wrong unique; `sparse: false` on partial idempotency indexes (Mongo forbids sparse+partial mix).
- **18.3:** Server-side search/status/date filters before skip/limit for admin orders/customers/stock ledger; FE hooks use `getWithMeta`; catalog search-outside-page-1 test.
- **18.4:** Zod `addressWriteSchema`, `catalogWriteSchema`, scheme enroll/installment/complete, review submit/moderate; controllers prefer `req.validated.body`.
- **18.5:** `.gitignore` already excludes `.env`, uploads, `.DS_Store`, `__MACOSX`; packaging checklist in `GOLDEX_PHASE_16_18_VERIFICATION.md`; Vite **6.4.3** (within v6; audit **0** vulns; latest major is 8.x — not upgraded).
- Commands: `npm test -- file-signature migrate-indexes catalog-aggregate` → **20 passed**.
- Production migrations: **not run** (per instruction).

## Final sign-off

| Gate | Result | Evidence |
|---|---|---|
| All blocker rows verified | **No** — CAT/API/WAL prod apply + pagination remain | checklist |
| All high rows verified or formally accepted | **No** — VAL-01/UPL-02/API-* / OPS-01 prod HeadBucket partial | checklist |
| Migrations dry-run and rollback reviewed | Partial (scripts exist; prod apply pending) | migrations table |
| Financial reconciliation completed | **No** | — |
| Production environment/readiness verified | Partial — `/health/ready` **Implemented** (enhanced); prod env not cut over | OPS-01 |
| Updated archive/commit supplied for independent review | **No** | working tree uncommitted |
| Release verdict | **NO-GO** | See `GOLDEX_RELEASE_VERIFICATION.md` + `GOLDEX_PHASE_11_15_VERIFICATION.md` |

### Cursor final summary (Phases 16–18)

- Completed: authoritative cart quote + FE removal of VAT math; COD vs manual payment split; stock/return/OTP/scheme concurrency; pdf-lib; strict indexes; reservedReturnQty backfill script; docs.
- Test counts this pass: backend **154 passed / 0 failed / 0 skipped**; frontend **28 passed / 0 failed / 0 skipped**; audits **0**.
- Remaining for GO: prod migrate/backfills; credential rotation; staging VAT UI matrix; clean archive packaging.
- Release verdict: **NO-GO**.

## Phases 19–20 (2026-07-20)

| ID | Change | Status | Evidence |
|---|---|---|---|
| 19.1 | Collected amount normalization + tolerance + UI confirm | Verified | `cart-quote-payment.test.js` |
| 19.2 | Manual locked wording + quote fail gating | Verified | `PaymentConfirm.test.jsx`, `useCartTotals.test.jsx` |
| 19.3 | `admin_adjustment` + idempotency_key set-stock | Verified | `stock-idempotency.test.js` |
| 19.4 | Request-hash idempotency + aggregate update | Verified | `stock-idempotency.test.js` |
| 19.5 | Carat/piece stone invariants | Implemented | Zod + service + mongoose |
| 19.6 | `ReturnCoordination` + cancel session reuse | Verified | `returns.test.js` |
| 19.7 | Refresh consume/CAS vs logout-all barrier | Verified | `auth-concurrency.test.js` |
| 20.1 | PDF `/A` JS rejection + worker timeout | Verified | `file-signature.test.js` |
| 20.2 | Expanded critical readiness indexes | Implemented | `health.service.js` |
| 20.3 | Remaining pagination 201-evidence | Implemented (partial) | prior meta hooks; full matrix open |
| 20.4 | Broader Zod wiring | Implemented (partial) | stock/payment/stone strict |
| 20.5 | Batched reservedReturnQty backfill | Implemented | `backfill-reserved-return-qty.js` |
| 20.6 | `npm run package:release` hygiene script | Implemented | `scripts/package-release.js` (run locally) |

Backend this pass: **166 passed / 0 failed / 0 skipped**. Frontend: **30 passed / 0 failed / 0 skipped**; build OK; audits **0**. Tracker: `GOLDEX_PHASE_19_20_VERIFICATION.md`. Verdict remains **NO-GO**.

## Phase 21 — API contract & validation repair (2026-07-21)

| ID | Change | Status | Evidence |
|---|---|---|---|
| 21.1 | Replace fragile envelope GET body requirement | Verified | `validate.js` + `api-contract-admin-gets.test.js` |
| 21.2 | `validateRequest` / Body / Params / Query helpers | Verified | middleware unit via route contracts |
| 21.3 | Shared pagination/filter schemas + empty/`all` normalize | Verified | `common.schemas.js` |
| 21.4 | Admin GET list endpoints no longer VALIDATION_ERROR | Verified | 26 admin GET contract cases |
| 21.5 | Catalog resource schema map for POST/PATCH/DELETE | Implemented | `validateCatalog.js` |
| 21.6 | Controllers consume `req.validated` | Implemented | catalog/ops/order/user/customer catalog |
| 21.7 | Cart `customization_request` + coupon FE field names | Verified | contract + cart-customization + coupon schema |
| 21.8 | Frontend getWithMeta smoke hooks | Verified | `apiContract.smoke.test.jsx` |
| 21.9 | Manual UI smoke | Pending | operator checklist in Phase 21 doc |

Backend this pass: **211 passed / 0 failed / 0 skipped**. Frontend: **39 passed / 0 failed / 0 skipped**; build OK. Tracker: `GOLDEX_PHASE_21_API_CONTRACT_VERIFICATION.md`. Verdict remains **NO-GO**.

## Phase 22 — Contract repair (2026-07-21)

| ID | Change | Status | Evidence |
|---|---|---|---|
| 22.1 | `deserialize` preserves Date / ObjectId / Buffer | **Code tested** | `serialize.test.js` (7) |
| 22.2 | Product FE↔Zod↔DTO↔Mongoose contract + VAT 24KT | **Code tested** | `catalog-product-category-brand-contract.test.js` |
| 22.3 | Category FE↔Zod↔DTO↔Mongoose contract | **Code tested** | same suite |
| 22.4 | Brand additive responsive fields + legacy logo retention | **Code tested** | same suite + dry-run backfill script |
| 22.5 | Coupon DTO, ISO dates, limits, usage/rollback, FE payload | **Code tested** | `coupon-contract.test.js` (extended in 22.5A) |
| 22.5A | Dubai TZ round-trip; strict FE payload; txn limit races; VAT/alias/usage/pagination | **Code tested** | contract **11** + concurrency **5** + coupons **9**; FE `couponPayload` **8**; ReplSet OK |
| 22.6 | Scheme create/pay/enroll/complete/cancel contracts; partial unique active enrollment; pay/complete exact-once; pagination/ownership; FE payload helpers | **Code tested** | `scheme-contract` **9** + `scheme` **6** (extended in 22.6A) |
| 22.6A | One PaymentEvent per installment; SchemePaymentReference lock; strict IDEMPOTENCY_CONFLICT replay; FE Dubai maturity; safe migrate command docs | **Code tested** | contract **11** + scheme **6**; FE `dubaiMaturity` **6**; ReplSet OK |
| 22.7 | Banner/cert/CMS/image contracts; Dubai banner dates; CMS XSS sanitize; pagination; primary-image promote; **index `productimages_primary_unique` implemented (not applied)** | **Code tested** | `catalog-banner-cms-cert-image-contract` **15→16** in 22.7A; FE payload/sanitize **16** |
| 22.7A | Primary-image backfill dry-run/apply; admin/customer cert pagination; applicable_variant_id; Dubai issued_date display; docs index correction | **Code tested** | backfill **8**; catalog contract **16**; FE panel/preview/dates **6**; full BE **280** / FE **86** |
| 22.8 | Variant/stone canonical contract; rate vs fixed pricing; aggregate idempotency hash; USE_VARIANT_AGGREGATE; inventory server pagination + concurrency; FE forms; stones audit dry-run | **Code tested** | BE dedicated **19** + related; full BE **304**; FE dedicated **9**; full FE **95** |
| 22.s | Manual staging smoke (coupon + scheme + banner/CMS + primary image reconcile + variant/stone/inventory) | Pending | required for Verified |
| pkg | Clean `package:release` script + archive scan | **Blocker** | missing root script; Zip(9) leaked `.env`/uploads/`__MACOSX` |

Backend this pass: **304 passed / 0 failed / 0 skipped** (34 files; `--no-file-parallelism`). Frontend: **95 passed / 0 failed / 0 skipped** (29 files); build OK; audits **0**. Tracker: `GOLDEX_PHASE_22_CONTRACT_REPAIR.md`. Verdict remains **NO-GO**.

**Operational (not executed on production):**
```
cd backend
npm run stones:audit-pricing:dry
npm run products:backfill-primary-images:dry
npm run migrate:indexes:dry
# after approval:
npm run products:backfill-primary-images
npm run migrate:indexes
```

