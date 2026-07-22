# GOLDEX Phase 21 — API Contract & Validation Repair

**Date:** 2026-07-21  
**Verdict:** **NO-GO** (architecture fix verified in automated contract tests; full UI smoke + production cutover still blocked)

## Root cause

Shared `validate(schema)` always parsed:

```js
{ body: req.body, params: req.params, query: req.query }
```

against Zod **envelope** schemas that required `body` to be an object.

On GET/DELETE, Express leaves `req.body` as `undefined` (json middleware does not invent `{}`). Zod then failed with:

`Invalid input: expected object, received undefined` → `422 VALIDATION_ERROR`

That broke admin catalog/inventory/orders/customers list pages and any other GET wired through `paginationQuerySchema` / envelopes.

Secondary issues:

- Empty query strings (`page=''`) failed numeric coerce.
- Generic catalog POST/PATCH used a passthrough body instead of per-resource schemas.
- Controllers sometimes preferred raw `req.query` / `req.body` over `req.validated`.
- Coupon write schema rejected frontend `discount_type` / `discount_value` / `min_order` / `valid_*` under `.strict()`.

## Architecture change

### Middleware (`backend/src/middlewares/validate.js`)

- `validateRequest({ body, params, query })` — validates **only** provided sections
- `validateBody` / `validateParams` / `validateQuery` helpers
- Legacy `validate(zodEnvelope)` still works but normalizes `req.body == null → {}`
- Config objects `{ body, params, query }` preferred for new routes
- Does **not** mutate Express `req.query` / `req.params` (parses copies)
- Failures → existing `VALIDATION_ERROR` via flatten (no Zod stacks to clients)

### Shared schemas (`backend/src/validators/common.schemas.js`)

- ObjectId, pagination, list filters, date/boolean query coercion
- `''` / `'all'` → undefined for filters
- `"false"` is not treated as boolean true

### Catalog resource map (`catalog.validators.js` + `validateCatalog.js`)

Per-resource create/update body schemas for:

`products | categories | brands | variants | images | stones | certificates | banners | cms-pages`

- DELETE validates params only (no body)
- GET list validates resource + query only

### Cart customization

Still accepts `customization_request` (strict unknown-key rejection retained). Survives cart → quote → order snapshot → DTOs.

## Endpoint matrix (frontend ↔ backend)

| Group | Method | Frontend URL | Validator | Status |
|---|---|---|---|---|
| Catalog list | GET | `/admin/catalog/:resource` | `validateRequest({ params, query })` | Contract tested |
| Catalog detail | GET | `/admin/catalog/:resource/:id` | params only | Contract tested |
| Catalog write | POST/PATCH | `/admin/catalog/:resource[/:id]` | `validateCatalogWrite` | Wired |
| Catalog delete | DELETE | `/admin/catalog/:resource/:id` | params only | Wired |
| Inventory | GET | `/admin/inventory/variants`, `low-stock`, `/admin/stock-ledger` | query schemas | Contract tested |
| Rates | GET | `/admin/rates/gold`, `/stone` | none (no body) | Contract tested |
| Orders | GET | `/admin/orders` | `orderListQuerySchema` | Contract tested |
| Customers | GET | `/admin/customers` | `customerListQuerySchema` | Contract tested |
| Coupons | GET | `/admin/coupons`, usage-summary | query / none | Contract tested |
| Schemes | GET | `/admin/schemes`, enrollments/all | none | Contract tested |
| Returns/Reviews | GET | `/admin/returns`, `/admin/reviews` | list query | Contract tested |
| Reports | GET | dashboard/sales | report query | Contract tested |
| Audit/Staff/Payments | GET | audit-log, staff, payment-events | query | Contract tested |
| Customer cart | GET/POST | `/customer/cart` | cart schemas | Contract tested |
| Customer catalog | GET | `/customer/catalog/*` | query/params | Contract tested |
| Add to cart customization | POST | `/customer/cart` | `cartAddSchema` | Contract tested |

Public API convention remains **snake_case** at the boundary; camelCase aliases accepted where already used, conflicting dual values rejected for customization.

## Changed files (Phase 21)

**Backend**

- `src/middlewares/validate.js`
- `src/middlewares/validateCatalog.js` (new)
- `src/validators/common.schemas.js` (new)
- `src/validators/order.validators.js`
- `src/validators/catalog.validators.js`
- `src/validators/commerce.validators.js`
- `src/validators/auth.validators.js`
- `src/routes/admin/catalog.routes.js`
- `src/routes/admin/operations.routes.js`
- `src/routes/admin/order.routes.js`
- `src/routes/admin/user.routes.js`
- `src/routes/admin/return.routes.js`
- `src/routes/admin/review.routes.js`
- `src/routes/admin/report.routes.js`
- `src/routes/staff/order.routes.js`
- `src/routes/customer/catalog.routes.js`
- Controllers: `admin.catalog`, `admin.operations`, `admin.order`, `admin.user`, `customer/catalog`
- `test/api-contract-admin-gets.test.js` (new)

**Frontend**

- `src/hooks/apiContract.smoke.test.jsx` (new)
- Prior cart customization tests retained

## Automated results (this pass)

| Suite | Result |
|---|---|
| Backend lint | pass |
| Backend tests | **211 passed / 0 failed / 0 skipped** (27 files) |
| Frontend lint | pass |
| Frontend tests | **39 passed / 0 failed / 0 skipped** (16 files) |
| Frontend build | pass |

Contract suite: `api-contract-admin-gets.test.js` — **31 passed** (all listed admin GETs + customer cart/catalog/customization).

Note: verification used existing `node_modules` (`npm run lint/test/build`). `npm ci` was not re-run in this pass.

## Manual UI smoke

| Area | Status |
|---|---|
| Admin dashboard / products / categories / brands / inventory / ledger / rates / orders / customers / coupons / schemes / returns / reports / audit / settings | **Pending operator confirmation** after restarting local servers against this tree |
| Customer catalog / product / add-to-cart with customization / cart / checkout / orders | **Pending** |

Restart backend after pull so the new middleware is loaded (`npm run dev --workspace backend`).

## Remaining / untested

- Exhaustive POST/PATCH/DELETE mutation matrix for every admin form field combination
- Full browser smoke checklist above
- Production migrations / deploy (explicitly out of scope)
- Release gates from Phases 11–20 still open

## Final verdict

**NO-GO** for production cutover.

**API contract blocker for admin GET VALIDATION_ERROR:** addressed and covered by automated contract tests. Do not mark release Verified until manual UI smoke confirms the same routes in the browser and remaining release gates are closed.
