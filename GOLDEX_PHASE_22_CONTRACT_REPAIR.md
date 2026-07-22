# GOLDEX Phase 22 — Complete frontend/backend contract repair

**Date:** 2026-07-21  
**Verdict:** **NO-GO**

Do not mark Verified from mocks or code inspection alone. Production Mongo migrations/backfills must not run from this phase.

## Primary objective

Fix every confirmed frontend → validator → controller → DTO → Mongoose mismatch.

- Do **not** convert Zod mutation schemas to `.passthrough()`.
- Public API bodies stay **strict**.
- Every accepted field must be explicitly validated, normalized, persisted, serialized, and covered by an Express/supertest integration contract test.

## Method (per mutation)

1. Inspect the actual frontend payload.
2. Inspect the route and Zod schema.
3. Inspect the controller.
4. Inspect DTO / `deserialize`.
5. Inspect the Mongoose model.
6. Inspect the service.
7. Confirm the response adapter/UI uses returned fields.
8. Add an integration contract test using the real Express app.

---

## Phase 22.1 — Date handling foundation

### Problem

`deserialize()` treated every object as a plain map and ran `Object.entries` + recursion.

| Value | Before | After |
|---|---|---|
| `Date` | `{}` (no enumerable own props) | same `Date` instance |
| Mongo `ObjectId` | `{ buffer: … }` mangled plain object | same ObjectId |
| `Buffer` | index map `{0:…,1:…}` | same Buffer |
| Plain `{ valid_from: Date }` | `{ validFrom: {} }` | `{ validFrom: Date }` |
| Plain snake_case | camelCase (unchanged behaviour) | camelCase |

### Fix

`backend/src/utils/serialize.js` — preserve `Date`, ObjectId-like (`toHexString`), and `Buffer` before recursing; arrays and plain objects still camelCase.

### Tests

`backend/test/serialize.test.js`

- `deserialize(new Date(...)) instanceof Date`
- `deserialize({ valid_from: new Date(...) }).validFrom instanceof Date`
- nested dates, ObjectIds, Buffers, snake_case plain objects

### Status

| Item | Status | Evidence |
|---|---|---|
| deserialize Date / ObjectId / Buffer preservation | **Code tested** | `serialize.test.js` |
| Coupon / scheme / certificate date mutations end-to-end | **Pending** | needs later Phase 22.x |
| Manual staging confirmation | **Pending** | required for Verified |

---

## Phase 22.2 — Product contract

### Frontend source of truth

`frontend/src/lib/productDefaults.js` → `toProductPayload()` / `PRODUCT_DB_FIELDS` (wizard + `ProductFormDialog` + `useAdminProducts`).

### Accepted / persisted fields

`category_id`, `brand_id`, `name`, `name_ar`, `slug`,  
`description`, `description_ar`, `short_description`, `short_description_ar`,  
`metal_type`, `metal_color`, `purity`, `gender`, `occasion`,  
`making_charge_type`, `making_charge_value`, `wastage_percent`, `tax_treatment`,  
`status`, `is_featured`, `display_order`, `is_customizable`, `customization_note`.

### Backend changes

- Strict Zod `productBody` expanded; create requires `name` + `slug`.
- Alias pairs supported; conflicting snake/camel dual values → **422**.
- Empty PATCH → **422**; unknown fields → **422**.
- DTO: `resolveTaxTreatment` always applied when purity and/or tax_treatment present.
- Eligible **24KT always `zero_rated`** (cannot force standard). Historical order tax snapshots untouched.

### Tests

`backend/test/catalog-product-category-brand-contract.test.js` (product cases)  
`frontend/src/lib/catalogContract.test.js` (`toProductPayload`)

### Status

| Item | Status |
|---|---|
| Exact FE create/update payload | **Code tested** |
| Every field persists + GET snake_case | **Code tested** |
| Unknown / empty PATCH / alias conflict / auth / search beyond page 1 | **Code tested** |
| Manual staging | **Pending** |

---

## Phase 22.3 — Category contract

### Frontend source of truth

`CategoryFormDialog` → `toCategoryPayload()` in `frontend/src/lib/catalogPayloads.js`.

### Accepted / persisted fields

`name`, `name_ar`, `slug`, `description`, `description_ar`,  
`parent_id` (nullable), `image_url`, `display_order`, `is_active`.

### Backend changes

- Zod category body includes `description` / `description_ar` (were missing).
- Create requires `name` + `slug`; aliases + empty PATCH / unknown / conflict rules same as products.
- List `search` filter extended to categories (name/slug).

### Status

| Item | Status |
|---|---|
| Create/update persistence + serialization | **Code tested** |
| Contract matrix (unknown, empty PATCH, auth, search) | **Code tested** |
| Manual staging | **Pending** |

---

## Phase 22.4 — Brand contract

### Problem

Frontend `BrandFormDialog` already sent responsive logo/banner URLs and `description_ar`, but Brand Mongoose schema only stored `name`, `nameAr`, `slug`, `description`, `logoUrl`, `displayOrder`, `isActive`.

### Additive model fields (legacy preserved)

| Field | Notes |
|---|---|
| `descriptionAr` | Arabic description |
| `logoDesktopUrl` / `logoTabletUrl` / `logoMobileUrl` | Responsive logos |
| `bannerDesktopUrl` / `bannerTabletUrl` / `bannerMobileUrl` | Responsive banners |
| `logoUrl` | **Legacy retained**; updates that set responsive logos do not clear or overwrite existing `logoUrl` unless `logo_url` is explicitly sent |

### FE / UI

- `toBrandPayload()` allowlists contract fields (no `id` / timestamps leaked into strict Zod).
- Storefront/admin prefer responsive logos with **fallback to `logo_url`** (`brandLogoUrl`).

### Backfill (not run on production)

Existing brands with only `logoUrl` and empty responsive slots **may** need a one-time copy so UI that prefers `logo_*_url` still shows a logo.

| Script | Mode |
|---|---|
| `npm run brands:backfill-responsive-logos:dry` | Dry-run (default) |
| `npm run brands:backfill-responsive-logos` | Apply (`--apply`) |

Idempotent: never clears `logoUrl`; never overwrites non-empty responsive URLs. **Do not run against production from this pass.**

### Status

| Item | Status |
|---|---|
| Schema + DTO + Zod + serialization | **Code tested** |
| Create/update with Arabic + all image URLs | **Code tested** |
| Legacy `logo_url` retention | **Code tested** |
| Backfill dry-run script authored | **Implemented** (not executed on prod) |
| Manual staging | **Pending** |

---

## Remaining Phase 22 work (not complete)

| Area | Status |
|---|---|
| Scheme / enrollment / installment payloads | Code tested through Phase 22.6A; staging pending |
| Address / cart / order remaining mismatches | Pending |
| Variant / image / banner / CMS remaining contracts | Code tested through Phase 22.7; staging pending |
| Full mutation contract suite beyond 22.5 | Pending |
| Manual staging matrix | Pending |
| Clean release packaging (`package:release`) | **Blocker** (see below) |

---

## Phase 22.5 — Coupon mutation, date, usage, and UI contract

### Root cause

Zod accepted FE-friendly aliases (`type`, `value`, `min_order_amount`, `starts_at`, …) and even `description`, but writes used `Coupon.create(deserialize(payload))` / `$set: deserialize(payload)`.

`deserialize()` only snake→camelCases keys. It does **not** map aliases to Coupon model fields, so accepted keys became unknown Mongoose properties and were **silently dropped**. `description` had no model field at all. `z.coerce.date()` also accepted timezone-less `datetime-local` strings (ambiguous).

### Canonical public snake_case contract

| API | Mongoose |
|---|---|
| `code` | `code` (trim + uppercase) |
| `discount_type` | `discountType` |
| `discount_value` | `discountValue` |
| `min_order` | `minOrder` |
| `max_discount` | `maxDiscount` (null = none) |
| `usage_limit` | `usageLimit` (null = unlimited; never 0) |
| `per_customer_limit` | `perCustomerLimit` |
| `valid_from` | `validFrom` (omit on create → `Date.now` default) |
| `valid_to` | `validTo` (null = no expiry) |
| `is_active` | `isActive` |

**Removed from API:** `description` (not used by UI/model).

**Aliases retained (normalized in `coupon.dto.js`, conflicts → 422):**

- `type` → `discountType`
- `value` → `discountValue`
- `min_order_amount` / `minOrderAmount` → `minOrder`
- `starts_at` / `startsAt` → `validFrom`
- `ends_at` / `endsAt` → `validTo`
- camelCase twins of canonical fields

**Never writable:** `id`, `used_count` / `usedCount`, timestamps, redemption counters.

### Date / timezone policy

- Admin coupon `datetime-local` fields represent **Asia/Dubai** wall-clock time (`BUSINESS_TIMEZONE` / `BUSINESS_UTC_OFFSET = '+04:00'`).
- FE helpers (`frontend/src/lib/dubaiTime.js`, mirrored in `backend/src/utils/dubaiTime.js`):
  - Dubai datetime-local → explicit UTC ISO before API submit (`dubaiDateTimeLocalToIso`)
  - API ISO → Dubai datetime-local for display (`dubaiDateTimeLocalFromInstant`)
  - Independent of browser/Node/container host timezone
- Default `valid_from` uses `nowDubaiDateTimeLocal()` (current Dubai wall time).
- Edit + resave without changes preserves the same UTC instant.
- API continues rejecting timezone-less datetime strings → **422**.
- DTO parses to real `Date`; PATCH date range validated on **merged** existing + patch state.

### Validation rules (summary)

- Create requires `code`, `discount_type`, positive `discount_value`.
- Empty PATCH / unknown fields / alias conflicts → 422.
- Percent ≤ 100; flat & percent value > 0; `min_order` ≥ 0; `max_discount` null or > 0.
- `usage_limit` null or positive int; cannot set below `usedCount` → **409** `COUPON_USAGE_LIMIT_TOO_LOW`.
- `per_customer_limit` positive int; cannot set below any customer’s `activeCount` → **409** `COUPON_CUSTOMER_LIMIT_TOO_LOW`.
- Duplicate normalized code → **409** `DUPLICATE_RESOURCE`.
- Manager auth required for mutations.
- FE `toCouponPayload` throws `CouponPayloadError` on NaN/Infinity/truncated decimals/invalid dates — never silently coerces.

### Usage / rollback invariants (code-tested)

- Summary/detail from `CouponRedemption` (active excludes `rolled_back`).
- Rollback decrements `usedCount` / per-customer `activeCount` exactly once; retry idempotent.
- Used coupon DELETE archives (`isActive=false`); unused hard-deletes.
- Order `couponSnapshot` immutable after admin coupon edit.
- 24KT-only + coupon → `tax_treatment=zero_rated`, `tax_rate=0`, `vat_amount=0`, total VAT 0.
- Mixed 24KT/22KT → 24KT zero-rated VAT 0; 22KT standard with VAT > 0 when taxable base > 0; allocated discounts sum to coupon; total identity holds.

### Concurrency (22.5A)

- `updateCoupon` runs in a MongoDB transaction; `usageLimit` write uses `usedCount: { $lte: newLimit }`.
- `reserveCouponRedemption` uses `$expr` against the **document’s current** `usageLimit` / `perCustomerLimit` (no stale caller-supplied limits).
- Concurrent checkout + admin limit reduction: at most one valid outcome; counters never negative; no duplicate redemptions.
- Transient txn conflicts rely on MongoDB `withTransaction` retry.

### List / usage pagination

- `GET /admin/coupons` — server-side search/status before page; returns `meta`; FE page size 25 + Previous/Next.
- `GET /admin/coupons/:id/usage` — applies `page`/`limit`; returns `meta`; FE usage dialog paginates (page size 20).
- Removed unbounded “first 200 only” list fetch.

### Migration / backfill impact

None required for this contract. No production migration/backfill run.

### Packaging blocker (unresolved)

Prior release archives (incl. Zip(9)) contained `.env`, uploads, `.DS_Store`, `__MACOSX`. Docs mention `npm run package:release`, but this workspace still lacks a root `package.json` / `scripts/package-release.js`. Do **not** claim clean packaging until a later hygiene phase. **No archive produced in 22.5 / 22.5A.**

### Tests (22.5 + 22.5A)

| Suite | Result |
|---|---|
| `test/coupon-contract.test.js` | **11 passed / 0 failed / 0 skipped** |
| `test/coupon-concurrency.test.js` | **5 passed / 0 failed / 0 skipped** (MongoMemoryReplSet started) |
| `test/coupons.test.js` | **9 passed / 0 failed / 0 skipped** |
| `test/dubaiTime.test.js` | **6 passed** (incl. Dubai datetime-local helpers) |
| Dedicated coupon suites (contract+concurrency+coupons) | **25 passed** |
| Full backend | **245 passed / 0 failed / 0 skipped** (30 files) |
| Frontend | **53 passed / 0 failed / 0 skipped** (19 files); build OK |
| `couponPayload.test.js` | **8 passed** |
| `npm audit` / `--omit=dev` (BE + FE) | **0 vulnerabilities** |

### Changed files (22.5 + 22.5A)

- `backend/src/services/coupon.dto.js`
- `backend/src/services/coupon.service.js` (txn-current limits via `$expr`)
- `backend/src/services/admin.service.js` (txn limit updates; usage pagination)
- `backend/src/services/order.service.js`
- `backend/src/utils/dubaiTime.js`
- `backend/src/validators/commerce.validators.js`
- `backend/test/coupon-contract.test.js`
- `backend/test/coupon-concurrency.test.js`
- `backend/test/dubaiTime.test.js`
- `frontend/src/lib/dubaiTime.js` (new)
- `frontend/src/lib/couponPayload.js`
- `frontend/src/lib/couponPayload.test.js`
- `frontend/src/components/admin/coupons/CouponFormDialog.jsx`
- `frontend/src/components/admin/coupons/CouponUsageDialog.jsx`
- `frontend/src/pages/admin/AdminCouponsPage.jsx`
- `frontend/src/hooks/useAdminCoupons.js`

### Status

| Item | Status |
|---|---|
| Canonical DTO + strict Zod create/PATCH | **Code tested** |
| Dubai timezone round-trip helpers | **Code tested** |
| Strict FE `toCouponPayload` (no silent NaN/trunc) | **Code tested** |
| Concurrency-safe admin limit updates | **Code tested** (MongoMemoryReplSet) |
| Strengthened VAT / alias / usage / pagination tests | **Code tested** |
| Manual staging coupon UI smoke | **Pending** (blocks Verified) |

---

## Phase 22.5A — Coupon contract correction (2026-07-21)

Corrections on top of 22.5. Did **not** start 22.6. Did **not** run production migrations, packaging, or credential ops.

### Root causes addressed

1. FE used `toISOString().slice(0,16)` → UTC wall text treated as local → instant shift.
2. FE payload helpers silently coerced invalid numbers / truncated decimals.
3. Admin limit updates were check-then-write vs concurrent `reserveCouponRedemption`.
4. VAT/alias/usage/pagination tests were weak or incomplete.

### Verdict for 22.5 / 22.5A

Keep **Code tested** until strengthened tests + concurrency tests (done) **and** manual staging coupon UI smoke (still pending).

---

## Phase 22.6 — Scheme API contract, installment payment, enrollment concurrency, completion repair (2026-07-21)

Did **not** redo Phases 1–22.5A. Did **not** run production migrations, backfills, credential rotation, deployment, S3 ops, or release ZIP.

### Root causes

1. **Installment pay contract mismatch:** FE sent `{ payment_method, note }` without `amount`; Zod required `amount` and preferred `payment_mode` → controlled **422**.
2. **Dual pay endpoints** risked diverging validation/behavior.
3. **Enrollment race:** `exists()` then `create()` allowed two concurrent active enrollments; no partial unique index.
4. **Completion:** FE could send client `amount`; `completedBy` / `statusHistory` not reliably persisted (history field missing from schema).
5. **Payment concurrency:** non-atomic claim could fail both concurrent payers or duplicate ledger writes under race.
6. **Lists/detail:** unpaginated admin lists; detail derived from list client-side; ownership gaps to close.
7. **Cancellation:** no strict cancel schema; refund policy for partially paid schemes was undocumented (COD wallet refund must **not** auto-authorize scheme cancel refunds).

### Canonical endpoint contracts

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/admin/schemes` | `{ name, name_ar?, description?, description_ar?, monthly_amount, tenure_months, bonus_months?, is_active?, terms?, terms_ar? }` | Create; unknown fields → 422 |
| PATCH | `/admin/schemes/:id` | ≥1 supported field | Empty PATCH → 422; never mutates enrollment snapshots |
| GET | `/admin/schemes` | query `page,limit,status,search` | `{ data, meta }` |
| GET | `/admin/schemes/enrollments` | same | `{ data, meta }` |
| GET | `/admin/schemes/enrollments/:id` | — | Staff auth |
| POST | `/admin/schemes/enrollments/:id/installments/:installmentId/pay` | see pay body | Same contract as by-id path |
| POST | `/admin/schemes/installments/:installmentId/pay` | see pay body | Same Zod + service |
| POST | `/admin/schemes/enrollments/:id/complete` | `{ note? }` only | Server payout from snapshots; reject `amount` |
| PATCH | `/admin/schemes/enrollments/:id` | `{ status: "cancelled", reason? }` | Cancel only |
| GET | `/customer/schemes/enrollments` | pagination when used | Ownership enforced |
| GET | `/customer/schemes/enrollments/:id` | — | Owner only → 404 for others |
| POST | `/customer/schemes/enrollments` | `{ scheme_id }` | Concurrent → one active; loser **409 ALREADY_ENROLLED** |

**Pay body (canonical):**

```json
{
  "amount": 100.00,
  "payment_method": "cash",
  "transaction_ref": null,
  "note": "Received at counter"
}
```

- `amount` required; must equal stored installment after 2-decimal money normalize; mismatch → **409 INSTALLMENT_AMOUNT_MISMATCH**.
- Methods: `cash` | `bank_transfer` | `card` only (no wallet/UPI/netbanking/store/gateway).
- Bank/card require non-empty `transaction_ref`; cash may be null.
- Legacy aliases (`payment_mode` / `paymentMode` / camelCase refs) accepted only when non-conflicting; conflicting dual values → 422.
- Staff identity from `req.auth.sub` only.

**Complete body:** `{ "note": "Maturity verified" }` — no client payout.

**Cancel body:** `{ "status": "cancelled", "reason": "…" }`.

### Frontend → backend mapping

| FE helper / UI | Sends |
|---|---|
| `toSchemePayload()` | snake_case scheme fields only |
| `toInstallmentPayPayload()` | `amount`, `payment_method`, `transaction_ref`, `note` |
| `toSchemeCompletePayload()` | `note` only (strips/rejects amount) |
| `SchemeRecordPaymentDialog` | bank/card ref required in UI |
| Customer scheme UI | contact store — **no** online gateway pay action |
| Admin lists | server `meta` Previous/Next |
| Enrollment detail | direct `GET …/enrollments/:id` |

### Concurrency / index design

- Partial unique index `schemeenrollments_active_customer_scheme_unique` on `{ customerId: 1, schemeId: 1 }` where `status: 'active'`.
- Installment pay: transactional + **atomic** `findOneAndUpdate` claim on pending/overdue → paid; `PaymentEvent.transactionId = scheme-inst:{enrollment}:{installment}`; ref uniqueness via `scheme-ref:{ref}`; `totalPaid` = sum of paid installments.
- Completion: txn + wallet credit + PaymentEvent + statusHistory + `completedBy`; concurrent → exactly one payout; replay idempotent.
- Cancellation: pending/overdue → cancelled; paid ledger untouched; **no automatic refund**.

### Cancellation refund-policy status (release gate)

No explicit product doc authorizes automatic wallet refund on scheme cancellation. Phase 22.6:

- Preserves all paid installment / PaymentEvent records.
- Performs **no** automatic refund.
- Treats **scheme cancellation refund decision** as an open **production release gate** (do not infer from COD order cancel wallet refund).

### Indexes / migrations created (not executed on production)

| Artifact | Purpose |
|---|---|
| Mongoose + `INDEX_SPECS` + readiness critical name | `schemeenrollments_active_customer_scheme_unique` |
| `npm run migrate:indexes:dry` | Dry-run index plan only |
| `npm run migrate:indexes` | **Apply** indexes — not a dry-run; do not run on prod from this phase |
| `node scripts/report-duplicate-scheme-enrollments.js` | Dry-run duplicate active groups; exit 2 if any; **no delete/merge** |

### Tests (22.6)

| Suite | Result |
|---|---|
| `test/scheme-contract.test.js` | **9 passed / 0 failed / 0 skipped** (MongoMemoryReplSet) |
| `test/scheme.test.js` | **6 passed** |
| Dedicated scheme (contract + scheme) | **15 passed** |
| Full backend | **254 passed / 0 failed / 0 skipped** (31 files) |
| Frontend | **58 passed / 0 failed / 0 skipped** (20 files); build OK |
| `schemePayload.test.js` | **5 passed** |
| `npm audit` / `--omit=dev` (BE + FE) | **0 vulnerabilities** |
| `npm ci` (nested FE/BE workspace) | **fails** — workspace root required; not clean-install CI |

Failed/skipped in final full runs: **none**. (Transient ECONNRESET / port-in-use seen once under parallel ReplSet start; not present in final suite.)

### Changed files (22.6)

**Backend:** `scheme.models.js`, `scheme.dto.js` (new), `scheme.service.js`, `commerce.validators.js`, admin/customer scheme routes+controllers, `migrate-indexes.js`, `health.service.js`, `report-duplicate-scheme-enrollments.js` (new), `scheme-contract.test.js` (new), `scheme.test.js`, `migrate-indexes.test.js`.

**Frontend:** `schemePayload.js` + test, `useSchemes.js`, `useAdminActions.js`, `SchemeFormDialog.jsx`, `SchemeRecordPaymentDialog.jsx`, `AdminSchemesPage.jsx`, `AdminSchemeEnrollmentDetailPage.jsx`.

**Docs:** this file, `GOLDEX_PRODUCTION_CHANGE_LOG.md`, `GOLDEX_RELEASE_VERIFICATION.md`.

### Manual staging checklist (schemes)

1. Create/edit scheme from admin dialog; unknown/empty/fractional rejected.
2. Enroll customer; second active enroll same scheme → ALREADY_ENROLLED.
3. Record cash pay (amount + method, no ref); bank/card require ref; wallet rejected.
4. Double-submit pay → one invoice / one PaymentEvent; reused ref on other installment rejected.
5. Complete only after maturity + all paid; note-only; wallet credited once; `completedBy` set.
6. Cancel active: unpaid installments cancelled; paid rows unchanged; no wallet refund.
7. Admin scheme/enrollment lists page 2 via server meta; detail via direct URL.
8. Customer cannot open another customer’s enrollment; AED displayed; no online pay CTA.

### Remaining release gates after 22.6

- Apply `migrate:indexes` on staging/prod (**dry-run first**); resolve any duplicate active enrollments from report script before unique index.
- Explicit **scheme cancel refund** product decision.
- Staging smoke (schemes + prior coupon/catalog).
- Credential rotation, packaging hygiene, financial reconciliation, live S3 HeadBucket.
- Remaining Phase 22.x mutation surfaces if any beyond schemes.

### Status

| Item | Status |
|---|---|
| Installment pay + dual endpoint parity | **Code tested** |
| Scheme create/update + FE `toSchemePayload` | **Code tested** |
| Atomic enrollment + partial unique index | **Code tested** (ReplSet) |
| Pay consume-once + completion exact-once | **Code tested** (ReplSet) |
| Cancellation no auto-refund + history | **Code tested** |
| Pagination / ownership DTOs | **Code tested** |
| Manual staging scheme smoke | **Pending** |
| Production index apply / duplicate report | **Not run** |

---

## Phase 22.6A — Payment ledger, idempotent replay, Dubai maturity (2026-07-22)

Did **not** redo 22.6. Did **not** run production migrations/backfills/deploy/credentials/S3.

### Root causes addressed

1. Bank/card payments wrote a second `scheme_installment_ref` **PaymentEvent** (lock misuse).
2. Paid-installment replay with different method/ref returned silent idempotent success.
3. FE maturity used browser-local `setHours` / `Date` compare instead of Asia/Dubai calendar.
4. Docs risked presenting `node scripts/migrate-indexes.js` as a dry-run.

### One-event ledger + reference lock

- Exactly **one** `PaymentEvent` per successful installment: `eventType=scheme_installment_paid`, `transactionId=scheme-inst:<enrollmentId>:<installmentId>`.
- Bank/card uniqueness via **`SchemePaymentReference`** (`normalizedReference` unique; normalization = **trim + uppercase**). Display keeps original trimmed case.
- Cash creates **zero** reference-lock rows.
- Legacy `scheme_installment_ref` PaymentEvents: **read for conflict checks only**; never created or deleted by new code.
- Dry-run backfill: `npm run schemes:backfill-payment-refs:dry` (apply: `npm run schemes:backfill-payment-refs` with `--apply`). **Not executed on production.**

### Replay semantics

- Idempotent **200** only when amount, `payment_method`, and normalized `transaction_ref` match the saved payment (cash null/empty refs consistent).
- Mismatch → **409 IDEMPOTENCY_CONFLICT**; does not overwrite method/ref/note/paidAt/recordedBy/invoice/PaymentEvent.
- **Note** may differ on replay and is ignored (never overwrites saved note).

### Dubai maturity (FE)

- `dubaiYmdFromInstant` / `isDubaiBusinessDateReached` / `formatDubaiBusinessDate` in `frontend/src/lib/dubaiTime.js`.
- Used by `schemeAdapters.js` and `AdminSchemeEnrollmentDetailPage.jsx`. UX-only; backend remains authoritative.

### Safe migration command order (not executed)

1. Maintenance window  
2. `node scripts/report-duplicate-scheme-enrollments.js`  
3. `npm run schemes:backfill-payment-refs:dry`  
4. Reconcile blockers  
5. `npm run migrate:indexes:dry`  
6. Explicit production approval  
7. `npm run schemes:backfill-payment-refs`  
8. `npm run migrate:indexes` ← **apply**, not dry-run  
9. Verify `/health/ready`  
10. Scheme payment smoke  

**Do not** present `node scripts/migrate-indexes.js` / `npm run migrate:indexes` as a dry run. Dry-run is only `npm run migrate:indexes:dry`.

### Tests (22.6A)

| Suite | Result |
|---|---|
| `scheme-contract.test.js` | **11 passed** (incl. replay + one-event + concurrent ref race) |
| `scheme.test.js` | **6 passed** |
| `migrate-indexes.test.js` | **5 passed** (includes `schemepaymentreferences_normalizedReference_unique`) |
| Dedicated scheme | **17 passed** |
| Full backend | **256 passed / 0 failed / 0 skipped** (31 files) |
| Frontend | **64 passed / 0 failed / 0 skipped** (21 files); build OK |
| `dubaiMaturity.test.js` | **6 passed** |
| Audits BE/FE | **0** |

### Changed files (22.6A)

- `backend/src/models/scheme.models.js` — `SchemePaymentReference`
- `backend/src/services/scheme.service.js` / `scheme.dto.js`
- `backend/scripts/migrate-indexes.js`, `backfill-scheme-payment-refs.js`
- `backend/src/services/health.service.js`, `backend/package.json`
- `backend/test/scheme-contract.test.js`, `migrate-indexes.test.js`
- `frontend/src/lib/dubaiTime.js`, `dubaiMaturity.test.js`, `schemeAdapters.js`, `schemeErrors.js`
- `frontend/src/pages/admin/AdminSchemeEnrollmentDetailPage.jsx`
- Docs: this file, change log, release verification

---

## Automated results (latest — through 22.7)

| Suite | Result |
|---|---|
| `catalog-banner-cms-cert-image-contract.test.js` | **15 passed / 0 failed / 0 skipped** (ReplSet OK) |
| `scheme-contract` + scheme | **17 passed** (unchanged) |
| Full backend suite | **271 passed / 0 failed / 0 skipped** (32 files) |
| Frontend suite | **80 passed / 0 failed / 0 skipped** (25 files) |
| Frontend build | OK |
| Backend/Frontend npm audit | **0** (incl. `--omit=dev`) |
| `npm ci` nested workspace | **fails** (not clean-install CI) |
| Manual staging | not run |
| Production migrations/backfills | **not run** |
| Release ZIP | **not produced** |

## Final verdict

**NO-GO** — Phases 22.1–22.7 are in code with automated coverage; packaging hygiene, staging smoke, production index/backfill apply, credential ops, and scheme-cancel refund policy remain open.

---

## Phase 22.7 — Banners, certificates, CMS, product images + stored-XSS (2026-07-22)

Did **not** redo 22.1–22.6A. Did **not** run production migrations/backfills/deploy/credentials/S3.

### Root causes

1. Banner Zod expected `link_url` and omitted position/mobile/AR/dates; model enum missing `strip`/`collection`/`gifting`.
2. Certificate Zod used `certificate_number`/`issuer`/`issued_at` vs FE `cert_number`/`authority`/`issued_date` + `metadata`.
3. CMS Zod used `body` vs FE/model `content`; public GET-by-slug did not require `isPublished`.
4. CMS rendered with unsanitized `dangerouslySetInnerHTML` (stored XSS).
5. Admin hooks used `limit: 200` while service max is 100; certificates client-filtered a capped list.
6. Primary image delete left zero primaries (no promote rule).

### Canonical contracts

**Banner:** `position` (hero|strip|collection|promo_top|deal|gifting|promo_bottom), `title`, `title_ar`, `subtitle`, `subtitle_ar`, `eyebrow`, `eyebrow_ar`, `image_url`, `image_url_ar`, `mobile_image_url`, `mobile_image_url_ar`, `cta_text`, `cta_text_ar`, `cta_link`, `display_order`, `is_active`, `starts_at`, `ends_at`.

**Banner Dubai date policy:** `starts_at` YYYY-MM-DD → Dubai day start; `ends_at` → inclusive Dubai day end; null = open bound; start ≤ end. Public list: active + start begun + end not passed.

**Certificate:** `product_id`, `variant_id` (nullable), `cert_number`, `authority`, `issued_date` (YYYY-MM-DD → Dubai day start), `metadata` (bounded plain object), `file_url`. No client `storage_key`.

**CMS:** `slug`, `title`, `title_ar`, `content`, `content_ar`, `is_published`. Duplicate slug → **409 SLUG_CONFLICT**. Public list + GET-by-slug require published (draft → 404).

**Image:** `product_id`, `variant_id?`, `image_url`, `alt_text`, `display_order`, `is_primary`. Set-primary transactional. Delete primary → promote lowest `display_order` then oldest `createdAt` (or none).

### CMS XSS allowlist

Tags: `p,br,h1–h4,ul,ol,li,strong,em,b,i,u,a,blockquote,hr`.  
Attrs: `a[href,title,target,rel]`. Protocols: `http,https,mailto`.  
Server sanitize on write + read; FE defensive sanitize on render (`sanitize-html`).

### Deletion behavior

- Product with order refs → archive status (no cascade wipe of history).
- Unreferenced product → txn delete variants/stones/images/certificates.
- Banner/CMS hard delete (manager catalog auth).
- Image DB delete first; promote primary if needed; no remote delete tied to failed DB txn in this phase.
- Order snapshots immutable.

### Changed files (22.7)

**Backend:** `catalog.validators.js`, `catalog.dto.js`, `catalog.service.js`, `catalog.models.js` (banner positions), `common.schemas.js` (catalog list filters), `htmlSanitize.js`, `package.json` (`sanitize-html`), `catalog-banner-cms-cert-image-contract.test.js`.

**Frontend:** `bannerPayload.js`(+test), `certificatePayload.js`(+test), `cmsPayload.js`(+test), `htmlSanitize.js`(+test), hooks (`useAdminBanners`, `useAdminCertificates`, `useCmsPages`, `useBanners`), form dialogs, `AdminBannersPage`, `AdminCmsPage`, `CmsPage`, `Footer`, `PolicyLinks`, `ProductCertificatesPanel`, `package.json`.

### Migrations / backfills

**New production index requirement from 22.7 (implemented in code, not applied to staging/production):**

| Field | Value |
|---|---|
| Name | `productimages_primary_unique` |
| Collection | `productimages` |
| Keys | `{ productId: 1 }` |
| Options | unique partial filter `{ isPrimary: true }` |
| Manifest | `migrate-indexes` INDEX_SPECS |
| Readiness | critical-index entry |

**Phase 22.7A reconciliation (dry-run-first; not executed against production):**

```bash
cd backend
npm run products:backfill-primary-images:dry
npm run migrate:indexes:dry
# after approval only:
npm run products:backfill-primary-images   # requires --apply
npm run migrate:indexes
```

Prior scheme index/backfill commands also remain not executed.

### Manual staging checklist

1. Create banner in each of 7 positions; Arabic + mobile images; CTA link; Dubai date window across midnight.
2. Certificate create with metadata; wrong variant rejected; customer sees safe fields only.
3. CMS draft hidden at `/page/:slug`; published renders; XSS payload does not execute.
4. Set-primary concurrent; delete primary promotes next.
5. Admin banners/CMS Previous/Next page 2; certificates filtered by product_id server-side.
6. Footer policies use known slugs (not capped CMS list).
7. Dry-run primary-image backfill; reconcile duplicates/missing; then migrate:indexes:dry.
8. Admin certificate panel Previous/Next across pages; create returns to page 1.
9. Customer certificates: `applicable_variant_id` scopes product-wide + variant; Load more/Next for page 2; badges do not claim completeness when more pages exist.
10. Certificate issued dates display as Dubai YYYY-MM-DD independent of host TZ.

### Status

| Item | Status |
|---|---|
| Banner/cert/CMS/image contracts | **Code tested** |
| CMS stored-XSS sanitization | **Code tested** (not Verified without staging) |
| Pagination hooks | **Code tested** |
| Primary-image index (`productimages_primary_unique`) | **Implemented, not applied** to staging/production |
| Primary-image reconciliation script | **Code tested** (dry-run/apply not run on production) |
| Admin/customer certificate pagination | **Code tested** |
| Dubai certificate date display | **Code tested** |
| Manual staging | **Pending** |

---

## Phase 22.7A — Primary image migration + certificate pagination (2026-07-22)

### Root causes addressed

1. Docs incorrectly claimed “None new for 22.7” despite `productimages_primary_unique`.
2. Unique primary index cannot be applied safely until duplicate/missing primaries are reconciled.
3. Admin `ProductCertificatesPanel` ignored `{ data, meta }` and never paged.
4. Customer `useCertificates` client-filtered a capped GET and could miss page-2 certificates.
5. Certificate issued dates used browser-local `toLocaleDateString`.

### Primary-image reconciliation

- Module: `productPrimaryImage.reconciliation.js`
- Script: `backfill-product-primary-images.js` (default dry-run; `--apply` required)
- Winner: lowest `displayOrder` → oldest `createdAt` → lowest `_id`
- Apply: keep one primary; never delete images/storage; transactional; idempotent

### Certificate pagination contract

**Admin:** `page` + `limit=10` (`ADMIN_CERTIFICATE_PAGE_SIZE`); Previous/Next; reset on `productId`; create → page 1; empty page > 1 → previous.

**Customer:** `GET /customer/catalog/certificates?product_id&applicable_variant_id&page&limit`  
- `product_id` required  
- without variant → all product certificates  
- with `applicable_variant_id` → `variantId` null + that variant (mismatch → `422 VARIANT_PRODUCT_MISMATCH`)  
- public DTO without `storage_key`  
- FE uses `getWithMeta`; query keys include product/variant/page/limit; Next/Previous; incomplete-list hint when `pages > 1`

### Dubai certificate date

`formatCertificateIssuedDate` → Dubai `YYYY-MM-DD` via `dubaiYmdFromInstant`; invalid/missing → `—`; admin + customer share helper.

### Changed files (22.7A)

**Backend:** `productPrimaryImage.reconciliation.js`, `backfill-product-primary-images.js`, `package.json` scripts, `catalog.service.js`, `common.schemas.js`, `migrate-indexes.js` (dotted `$group` key fix), `product-primary-image-backfill.test.js`, `catalog-banner-cms-cert-image-contract.test.js`.

**Frontend:** `ProductCertificatesPanel.jsx`(+test), `useCertificates.js`, `CertificatePreview.jsx`(+test), `certificateDates.js`(+test).

### Verification (22.7A)

| Suite | Result |
|---|---|
| Backend full | **280 passed / 0 failed / 0 skipped** (33 files, `--no-file-parallelism`) |
| Backend primary-image backfill | **8 passed** |
| Backend catalog 22.7/22.7A contract | **16 passed** |
| Backend migrate-indexes | **5 passed** |
| Frontend full | **86 passed / 0 failed / 0 skipped** (28 files) |
| Frontend build | OK |
| Audits BE+FE | **0** |

### Verdict

**NO-GO** — index/backfill not applied to staging/production; staging smoke pending; prior release gates remain open.

---

## Phase 22.8 — Variant, Stone Pricing, and Inventory Contract Closure (2026-07-22)

### Verified root causes (all confirmed against source before fix)

1. Inventory UI fetched `page=1&limit=100` and filtered client-side — records beyond 100 invisible.
2. `+/-` used absolute `set-stock` without `expected_before` — lost updates under concurrency.
3. `Math.max(0, Number(stock) || 0)` coerced invalid/blank stock to zero.
4. `Number(value) || 2` turned valid `low_stock_threshold=0` into `2`.
5. Purity UI omitted `21k` despite backend support.
6. ProductStone lacked label/shape/size/setting/pricing_mode/manual_charge — edit round-trip lost attrs.
7. Stone payloads sent display label as `stone_type` → `STONE_RATE_MISSING`.
8. UI “manual charge” vs live rate pricing mismatch.
9. `stone_rate_id` stored but pricing did not validate orphan/mismatch against canonical type/grade/unit.
10. Incomplete variant/stone alias conflict rejection vs products/categories/brands.
11. Aggregate create idempotency accepted mismatched replay payloads.
12. Client-writable reserved metadata/idempotency fields.
13. Generic POST/PATCH `variants`/`stones` bypassed `/variants/complete` invariants.

### Final contracts

**Product stone (snake_case):**  
`stone_rate_id`, `label`, `stone_type`, `grade`, `unit` (`carat|piece`), `pricing_mode` (`rate|fixed`), `stone_count`, `weight`, `shape`, `size_mm`, `setting_type`, `manual_charge` (complete line charge when fixed), `display_order`.

| Mode | Rules |
|---|---|
| `rate` | `stone_rate_id` required; canonical type/grade/unit from StoneRate; live quote uses **current** rate for that key; orphan/mismatch → 409/422 |
| `fixed` | no rate id; `manual_charge ≥ 0` is the **complete line charge**; quote uses saved charge |

**Variant aggregate:** strict create/update; purity `14k|18k|21k|22k|24k` (normalized lowercase); 24K forced `zero_rated`; stock update requires `expected_stock_qty`; identical hash replay OK; mismatched key → `409 IDEMPOTENCY_CONFLICT`; generic mutate → `422 USE_VARIANT_AGGREGATE`.

**Inventory list:** `page`, `limit`, `search` (sku/label/product name), `stock_state`, optional `product_id` → `{ data, meta }`.  
**Stock:** `+/-` → adjust (delta); typed absolute → `set-stock` + `expected_before` + per-action idempotency key.

### Concurrency

- Concurrent `+1` → `+2`.
- Concurrent decrement cannot go negative (`requireAvailable` on negative adjust + transactional ledger).
- Stale absolute set → `409 STOCK_VERSION_CONFLICT`.
- Identical stock replay → one movement; changed body same key → `IDEMPOTENCY_CONFLICT`.
- Ledger `qty_before + delta = qty_after`.

### Dry-run / backfill (not executed)

```
cd backend
npm run stones:audit-pricing:dry
```

Read-only JSON report (orphan rates, mismatches, fixed-only, invalid weights/counts, metadata `stone_groups`, unquotable active variants). No apply script executed.

### Changed files (22.8)

**Backend:** `catalog.models.js`, `catalog.validators.js`, `numeric.js`, `catalog.dto.js`, `catalog.service.js`, `pricing.service.js`, `admin.service.js`, `inventory.service.js`, `order.validators.js`, `common.schemas.js`, `operations.routes.js`, `admin.operations.controller.js`, `scripts/audit-product-stones.js`, `package.json`, tests (`variant-stone-inventory-contract`, `catalog-aggregate`, `stock-idempotency`, `pricing-live`).

**Frontend:** `numberParse.js`, `productDefaults.js`, `stonePricing.js`, `constants.js`, `VariantStonesEditor.jsx`, `VariantFormDialog.jsx`, `ProductVariantsStep.jsx`, `useAdminProducts.js`, `useAdminInventory.js`, `AdminInventoryPage.jsx`, `AdminStockLedgerPage.jsx`, tests (`variantStoneInventoryContract`, `apiContract.smoke`).

### Tests added / results

| Suite | Result |
|---|---|
| Backend dedicated 22.8 | **19 passed** |
| Backend related (aggregate/stock/pricing-live) | **23 passed** |
| Backend full | **304 passed / 0 failed / 0 skipped** (34 files, `--no-file-parallelism`) |
| Frontend dedicated 22.8 | **9 passed** |
| Frontend full | **95 passed / 0 failed / 0 skipped** (29 files) |
| FE build | OK |
| Audits BE+FE | **0** |
| Earlier sandbox MMS hang | Failed under sandbox (code 48); re-ran with full perms — **not counted as pass** |

### Manual staging checklist (Pending — not Verified from unit tests)

1. Create 21K variant.
2. Create 24K variant → VAT AED 0.00.
3. Add rate-linked piece stone.
4. Add rate-linked carat stone.
5. Add fixed/manual stone.
6. Edit → shape/size/setting survive.
7. Quote stone breakup correct.
8. Change StoneRate → new quote updates.
9. Existing order/invoice unchanged.
10. Inventory search finds record beyond 100.
11. Rapid double +1 → +2.
12. Two-admin stale set → conflict UX.
13. Ledger before/after reconcile.
14. Mixed 24K/22K cart VAT line-based.

### Remaining release gates

Prior gates still open: staging smoke, index/backfill apply, scheme refund decision, credential rotation, release packaging, wallet reconcile, S3 HeadBucket.

### Verdict

**NO-GO** — local contract closure only; historical operational gates remain open.
