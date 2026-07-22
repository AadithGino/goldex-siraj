# Goldex Phase 19–20 Verification

**Verdict: NO-GO** — code remediation for Phases 19–20 is in the working tree; production cutover gates remain open.

| Field | Value |
|---|---|
| Date | 2026-07-20 |
| Scope | Financial/inventory/concurrency (19) + PDF/readiness/pagination/Zod/backfill/packaging (20) |
| Production actions | **None** — no prod migrations, deploys, credential rotation, or prod data access |

## Mandatory business invariants (preserved)

- Canonical 24KT lines are `zero_rated`; 24KT VAT is AED 0.00
- Mixed carts tax independently per line
- COD reprices only at physical handover
- Manual bank/card orders preserve locked placement snapshots
- Refunds/invoices use immutable order-item snapshots

---

## Phase 19

### 19.1 Collected-payment amount handling — **Verified** (automated)

| | |
|---|---|
| Root cause | Validators accepted `amount_collected` / `amountCollected`, but `collectPayment` only read `input.amount` |
| Invariant | Collected amount required; match expected within AED 0.01; persist expected+collected+mode+ref+staff+verifiedAt; one PaymentEvent/invoice on retry |
| Files | `order.validators.js`, `order.service.js`, `commerce.models.js`, `AdminOrderFulfillmentSidebar.jsx`, `useAdminActions.js` |
| Tests | `cart-quote-payment.test.js` (correct/incorrect COD+manual, aliases, missing, concurrent, 24KT VAT 0, mixed manual buckets) |
| Migration | Schema additive `paymentCollection.expectedAmount` — no backfill required |
| Rollback | Revert service/validators/UI; field unused if reverted |

### 19.2 Manual-payment UI + quote gating — **Verified** (FE tests + wording)

| | |
|---|---|
| Root cause | PaymentConfirm claimed manual totals live-reprice at verification |
| Invariant | Manual locked at place; COD estimate until handover; block place while quote loading/failed; never show AED 0 as valid on failure; coupon savings from `quote.coupon.discount_amount` |
| Files | `PaymentConfirm.jsx`, `AdminOrderPaymentPanel.jsx`, `CheckoutPage.jsx`, `useCartTotals.js`, `OrderReview.jsx` |
| Tests | `PaymentConfirm.test.jsx`, `useCartTotals.test.jsx` (error → null total, coupon identity) |

### 19.3 Admin stock mutation reason — **Verified**

| | |
|---|---|
| Root cause | FE sent `admin_set_stock` not in StockMovement enum |
| Invariant | Canonical reason `admin_adjustment`; set-stock requires `idempotency_key` + optional `expected_before` |
| Files | `useAdminInventory.js`, `order.validators.js`, `admin.operations.controller.js`, `inventory.service.js` |
| Tests | `stock-idempotency.test.js` frontend payload / sequential / retry / conflict / ledger |

### 19.4 Idempotency semantics — **Verified** (stock + variant aggregate)

| | |
|---|---|
| Root cause | Key alone meant “something happened”; conflicting payloads could no-op wrongly |
| Invariant | Persist operationType + requestHash; same key+payload → original; same key+different payload → `409 IDEMPOTENCY_CONFLICT`; `updateVariantComplete` aggregate hash |
| Files | `inventory.service.js`, `rate.models.js`, `catalog.service.js` |
| Tests | `stock-idempotency.test.js` |

### 19.5 Stone invariants — **Implemented** (Zod + service + mongoose)

| | |
|---|---|
| Root cause | Carat stones could omit weight; piece could omit count |
| Invariant | carat → weight > 0; piece → stone_count ≥ 1 (optional weight allowed for piece) |
| Files | `catalog.validators.js`, `catalog.service.js`, `catalog.models.js` |
| Tests | Covered via catalog aggregate paths; dedicated pricing rejection remains available in `pricing-live` / create update |

### 19.6 Return overlap concurrency — **Verified**

| | |
|---|---|
| Root cause | Whole vs line paths did not share one coordination document |
| Invariant | `ReturnCoordination` per order; cancellation/whole exclusive; lines share `line_return`; cancel+refund same session |
| Files | `commerce.models.js`, `return.service.js`, `order.service.js` (cancelOrder session reuse), `migrate-indexes.js` |
| Tests | `returns.test.js` pairings |
| Migration | New collection/index `returncoordination_orderId_unique` — dry-run migrate only in prod |

### 19.7 Refresh / logout-all race — **Verified**

| | |
|---|---|
| Root cause | Consume then issue could race with tokenVersion bump |
| Invariant | Consume commits first; CAS+issue second txn; logout-all / password reset bump generation atomically with revoke |
| Files | `auth.service.js` |
| Tests | `auth-concurrency.test.js` barrier + password-reset race |

---

## Phase 20

### 20.1 PDF validation — **Verified**

| | |
|---|---|
| Root cause | Annotation `/A` JavaScript accepted |
| Invariant | Reject `/A`,`/AA`,`/OpenAction`,`/JS`,`/JavaScript`,`/Launch`, RichMedia, XFA, EmbeddedFiles, encrypted, oversized; worker-terminated timeout |
| Files | `pdfInspect.js`, `fileSignature.js`, `pdfParse.worker.js` |
| Tests | `file-signature.test.js` (valid, fake, truncated, pages, OpenAction, **/A JS**, AA, embed, XFA, MIME, bytes) |

### 20.2 Readiness critical indexes — **Implemented**

| | |
|---|---|
| Change | Expanded `CRITICAL_INDEX_NAMES` (returns, coordination, variant idempotency, payment txn, invoice, stock, wallet/coupon/auth) |
| Files | `health.service.js`, `migrate-indexes.js` |
| Tests | `health.test.js` asserts failed checks when 503; index matching unit tests in `migrate-indexes.test.js` |
| Migration | Do **not** run in production from this pass |

### 20.3 Server-side pagination — **Implemented** (partial)

| | |
|---|---|
| Status | Prior list endpoints return meta; remaining storefront/admin surfaces still need 201-record evidence matrix |
| Gap | Full 201-record evidence for every listed resource not completed in this pass → keep **Implemented** |

### 20.4 Zod route validation — **Implemented** (partial)

| | |
|---|---|
| Status | Stock/payment/stone schemas tightened; broader resource-specific wiring still incremental |
| Gap | Not every catalog/settings route fully strict → **Implemented** |

### 20.5 Backfill reservedReturnQty — **Implemented**

| | |
|---|---|
| Change | Cursor/batched, dry-run default, preflight invalid → exit 2, JSON totals, `--after` resume |
| Files | `scripts/backfill-reserved-return-qty.js` |
| Prod | Dry-run only until reconciled |

### 20.6 Release packaging — **Implemented**

| | |
|---|---|
| Change | `npm run package:release` allowlist zip + hygiene scan |
| Files | `scripts/package-release.js`, root `package.json` |
| Assert | `.env`=0, uploads=0, node_modules=0, `.DS_Store`=0, `__MACOSX`=0, GOLDEX docs present |

---

## Local verification commands (this pass)

```text
Backend:  npm run lint → exit 0
          npm test     → 166 passed / 0 failed / 0 skipped
          npm audit / npm audit --omit=dev → 0 vulnerabilities
Frontend: npm run lint → exit 0
          npm test     → 30 passed / 0 failed / 0 skipped
          npm run build → exit 0
          npm audit / npm audit --omit=dev → 0 vulnerabilities
Packaging: npm run package:release (script present; run locally to mint scanned zip)
```

Do **not** treat total test *definitions* as passed count; report run outcomes only.

## Open gates (keep NO-GO)

1. Production migrate/backfill dry-run + reconcile  
2. Credential rotation  
3. Staging VAT/payment/return matrix  
4. Live S3 readiness  
5. Financial reconciliation  
6. Clean archive hygiene scan on final handoff zip  
