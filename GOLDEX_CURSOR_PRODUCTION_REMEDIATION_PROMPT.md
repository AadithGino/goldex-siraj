# Goldex Production Remediation — Cursor Master Prompt

Copy everything below into Cursor Agent mode from the `goldex-production` project root.

---

You are the lead production engineer for this Express.js, Node.js, MongoDB/Mongoose, and React/Vite ecommerce application. Fix the audited defects below across backend and frontend. Work in phases, inspect the real implementation before changing it, and verify every phase before continuing.

## Non-negotiable working rules

1. Read the relevant models, services, controllers, routes, adapters, hooks, and pages before editing. Do not assume that a frontend or backend field is correct merely because it exists.
2. Preserve the intended business model:
   - COD: the customer pays the live recalculated amount when the package is handed over.
   - Manual payment: bank transfer/card is coordinated outside the website and only owner/manager can mark it verified and paid.
   - No online payment gateway is being introduced.
   - Refunds are credited to the customer wallet for now.
   - Do not broaden staff permissions. Keep the existing backend manager/owner restrictions and hide unauthorized UI actions.
3. Backend validation and authorization are authoritative. Never rely only on disabled frontend controls.
4. Controllers must remain thin. Put domain logic in services and request validation in schemas/middleware.
5. Monetary values must be calculated on the backend. Use consistent two-decimal rounding and never trust totals submitted by the browser.
6. Financial and inventory state changes must be atomic and idempotent. Use MongoDB transactions and conditional writes where appropriate.
7. Do not hard-delete financial history. Do not silently cascade-delete customer/order/audit records.
8. Do not introduce mock data, hardcoded OTPs, fixed gold prices, fake success responses, or Supabase dependencies.
9. Preserve all previously completed fixes, including certificate storage naming, paid-only sales rules, live COD repricing, safe date handling, role-specific sessions, customer order adapters, and coupon-usage population/rollback behavior.
10. Use the accompanying `GOLDEX_PRODUCTION_CHANGE_LOG.md` as the source-of-truth checklist. Update it after every phase with exact files changed, tests added, commands run, results, migrations, and remaining risks. Never mark an item complete without evidence.

## Phase 0 — Baseline and safety

- Record Node/npm versions, environment assumptions, and current build/test results.
- Run backend lint and tests and the frontend production build.
- Document whether MongoDB is configured as a replica set. Core transactional flows must fail readiness with a clear diagnostic if transaction support is unavailable in production.
- Add no feature changes in this phase.
- Update the change log, then continue only when the baseline is recorded.

## Phase 1 — Admin dashboard and reports contracts

### Dashboard

- Define one documented dashboard response contract and make backend and frontend use it consistently.
- Include today's paid revenue/order count, current-month paid revenue/order count, orders-by-status, pending orders, pending reviews, pending returns, low-stock count, and active-customer count.
- Calculate UAE business-day and month boundaries using `Asia/Dubai`, not UTC.
- Revenue must include only orders with `paymentStatus=paid` and a valid `paidAt`.

### Reports

- Standardize report response fields. Daily rows must expose one agreed amount field and order-count field; top products must expose one agreed sold-quantity and revenue field.
- Pass the selected `from` and `to` range to both sales and top-products queries.
- Use Asia/Dubai date boundaries and validate `from <= to`.
- Ensure UI cards, daily display, CSV export, and top-products display use the real response fields.
- Add service/API contract tests that would fail on the current mismatches.

## Phase 2 — Checkout, COD limits, wallet, and coupons

### Server-side checkout rules

- In `placeOrder()`, enforce `minimumOrderAmount`, `codMinOrderAmount`, and `codMaxOrderAmount` against server-calculated totals. Return stable 409/422 error codes with useful messages.
- Reject invalid/non-finite `wallet_use`, quantities, IDs, gift-note lengths, and unsupported payment methods through validation middleware.

### Atomic wallet

- Eliminate the wallet overspending race. Introduce an atomic wallet balance/reservation mechanism, such as a `WalletAccount` document with a unique `customerId`, current balance, and optimistic/conditional debit.
- Keep `WalletTransaction` as the immutable ledger and ensure balance mutation plus ledger entry happen in the same transaction.
- Route every wallet credit/debit—order reservation, cancellation, return, scheme payout, adjustment, excess release—through one wallet service.
- Make every mutation idempotent using a unique business key.
- Provide a migration/backfill script that derives wallet-account balances from the existing ledger, is safe to rerun, and reports discrepancies without destroying data.
- Add concurrent checkout tests proving the balance cannot go negative or be spent twice.

### Coupon concurrency

- Make global usage-limit and per-customer-limit enforcement atomic under concurrent orders.
- Add the required unique/indexed redemption strategy and conditional coupon increment.
- Preserve rollback semantics for cancelled orders and prevent `usedCount` from drifting from active redemptions.
- Repricing must preserve the order's accepted coupon snapshot; later coupon deactivation/expiry must not silently remove the promised discount. Store the required coupon calculation snapshot on the order.
- Add concurrency, cancellation, and repricing tests.

## Phase 3 — Cancellation, returns, and wallet refunds

- Define explicit refund accounting for COD, bank transfer, card, wallet contribution, coupon discount, VAT, shipping, and rounding.
- When a paid manual order is cancelled, credit the correct refundable amount to the wallet and record an immutable refund/payment event. Never set `paymentStatus=refunded` without a matching completed refund ledger entry.
- Validate that `order_item_id` belongs to the customer's order when the return is requested and again when it is completed.
- Store/refine per-line refundable allocation at final payment so partial refunds cannot exceed the amount actually paid. Allocate order discounts and tax deterministically, handle rounding on the final line, and cap cumulative refunds.
- Track returned quantity/value per order item. Add an order state such as `partially_returned`, or derive an equivalent unambiguous state without marking the entire order returned for a partial return.
- Ensure stock is restored exactly once and only for accepted returned quantities.
- Align frontend eligibility with backend: returns only after `delivered`, within the configured return window.
- Add tests for full return, partial discounted return, invalid item ID, duplicate completion, paid manual cancellation, wallet-only order, and mixed wallet/manual payment.

## Phase 4 — Catalog visibility, integrity, inventory, and pricing

### Public visibility

- Public pricing, cart, wishlist, variants, images, stones, and certificates must require an active parent product and active variant where applicable.
- Draft/archived products must not be retrievable or priceable through guessed IDs.

### Safe mutations and deletion

- Replace unrestricted `deserialize(payload)` writes with allowlisted DTOs plus validation for every catalog resource.
- Prevent generic variant PATCH from changing stock fields. Stock may change only through the inventory service so every change has a `StockMovement`.
- Prefer product/variant archival. If permanent deletion is supported, implement a dependency check or an explicit transactional cascade for non-financial catalog data. Never leave orphan variants, stones, images, certificates, carts, or wishlists.
- Make product variant + stock + stones creation/update one backend domain operation and one transaction. Do not delete old stones until the replacement payload is validated and can commit atomically.
- Make primary-image selection one atomic backend action that guarantees at most one primary image per product. Add an appropriate partial unique index if supported.
- Delete/reconcile storage objects when their database records are deliberately deleted, with idempotent cleanup and failure logging.

### Pricing correctness

- Decide and document whether variant `taxTreatment` overrides product treatment; implement that rule consistently.
- Validate `effectiveWeight` against the chosen weight semantics. It must never accidentally bill more metal than allowed.
- Use `stoneRateId` when present. Otherwise use a normalized, case-safe compound lookup.
- Do not discard all live stone charges because one stone lacks a rate. Either reject pricing with a specific missing-rate error or apply a documented per-line fallback—never silently fall back for the whole variant.
- Validate rate units and prevent a carat/piece mismatch.
- Add pricing tests for mixed stones, missing rate, variant tax override, effective weight, and fixed-price/live-price behavior.

### Inventory correctness

- Replace the frontend fetch-then-delta “set stock” flow with one backend command accepting `newQuantity` and optionally `expectedCurrentQuantity`. Apply it atomically and return a conflict if stale.
- Populate the product category needed by the inventory UI or change the UI to use a documented response.
- Make stock ledger pagination server-side with total count and filters.

## Phase 5 — Gold schemes

- Define a single maturity rule. Paying every installment early must not automatically complete/credit the scheme before the final due date.
- Implement one manager/owner completion endpoint that verifies: active enrollment, all required installments paid, maturity reached, payout within the server-calculated allowed amount, and no existing payout.
- Credit the wallet idempotently in the same transaction and store completion/payout metadata.
- Remove the frontend mutation that intentionally throws; connect the completion button to the real endpoint.
- Basic staff must not see or invoke manager-only installment/payment/completion actions.
- On cancellation, mark pending/overdue installments cancelled in the same transaction while preserving paid installments.
- Implement overdue status deterministically, either via a scheduled job or query-time derivation with a documented production schedule.
- Add tests for early full payment, maturity completion, duplicate payout, cancellation, overdue transitions, and staff-role authorization.

## Phase 6 — Validation, ownership, session revocation, and uploads

### Request validation and allowlists

- Add validation middleware for every write route: orders, cart, wishlist, addresses, returns, reviews, catalog, rates, coupons, schemes, inventory, customers, staff, and settings.
- Address create/update must allow only delivery fields; never accept `customerId`, timestamps, or ownership fields.
- Require recipient name, UAE phone, street/building, area/city/emirate, and country according to the checkout form. Normalize values and set the first address as default.
- Guarantee at most one default address per customer and choose a replacement default after deleting the current default.
- Wishlist/cart must verify active parent product and customization must be accepted only when the product is customizable, with length limits.
- Admin customer/staff updates must use explicit allowlists and must not permit identity/security/internal fields to be overwritten accidentally.

### Session revocation

- Make protected requests reject deactivated accounts and stale `tokenVersion` access tokens promptly. Preserve separate customer/staff cookie/session namespaces.
- Add tests for staff deactivation, role change, customer deactivation, refresh rotation, logout, and cross-role isolation.

### Upload hardening

- Verify file signatures/magic bytes rather than trusting multipart MIME values.
- Apply image/PDF allowlists, size limits, safe generated names, and image decoding where appropriate.
- Associate return-proof uploads with a return draft/request or issue a short-lived upload token; prevent unlimited orphan uploads.
- Store storage keys and implement cleanup for abandoned/replaced files.
- Document the S3/CDN public-access expectation and return stable configuration errors.

## Phase 7 — Pagination, frontend data loading, and UX

- Replace the frontend's seven independent `limit=200` catalog downloads with backend listing/detail endpoints that return populated/structured product cards and full product detail.
- Add server pagination, filters, sorting, and totals. Do not silently hide products after 200 related records.
- Fetch product detail once by slug or ID. Do not download the complete catalog twice.
- Fix the `occasion` versus `occasions` contract.
- Add scoped admin customer endpoints for that customer's orders, schemes, wallet balance, and paginated wallet history. Do not download every order/enrollment and filter in the browser.
- Wallet balance must come from the authoritative balance, not the last 500 transactions.
- Add pagination to admin orders, customers, payment events, audit logs, and stock ledger.
- Correct the stone delete action: either archive the stone/rate family explicitly or clearly delete all eligible history and current state through one authorized backend operation. The UI confirmation must match what happens.
- Add route-level error boundaries and query error/empty/loading states.
- Add route-based code splitting to address the Vite main-chunk warning without harming UX.

## Phase 8 — Regression verification and release evidence

Add integration tests using a real disposable MongoDB replica-set test environment for transactional behavior. Unit mocks alone are insufficient for wallet, stock, coupon, return, order, and scheme concurrency.

At minimum verify:

- Customer OTP/login/profile/address/cart/wishlist/checkout/order-detail/return/wallet flows.
- Owner/manager/staff login and authorization boundaries.
- COD placement, live handover repricing, cash collection, invoice, reports.
- Manual bank/card verification, invoice, reports, cancellation refund.
- Coupon validation, usage, concurrency, cancellation rollback, order snapshot.
- Product CRUD, variants, stones, images, certificates, archive/delete behavior.
- Gold and stone rate history/current-rate transitions.
- Inventory set/adjust, oversell protection, and immutable ledger.
- Scheme enrollment, installments, overdue, maturity, payout, cancellation.
- Dashboard and report values across an Asia/Dubai day boundary.
- Upload rejection and cleanup cases.

Run and record:

```bash
cd backend && npm run lint && npm test
cd ../frontend && npm run build
```

If frontend lint/tests are absent, add ESLint and a focused Vitest/React Testing Library suite for adapters, checkout eligibility, reports, order detail, and permission-gated controls. Run dependency/security checks and document—not conceal—remaining findings.

## Completion requirements

- Do not say “fixed” because a build passes.
- Every checklist row must include implementation evidence and test evidence.
- Include migration/backfill and rollback instructions for every schema/index change.
- Update `.env.example`, operational documentation, and seed data when contracts change.
- Provide a final API contract summary for dashboard, reports, product listing/detail, wallet, returns, and schemes.
- Finish by updating `GOLDEX_PRODUCTION_CHANGE_LOG.md`, including all unresolved risks and exact verification commands.
- Stop and report a blocker rather than inventing a business rule or weakening authorization.

---

After Cursor finishes, share the completed change log and the updated project archive for independent cross-verification.