# Goldex Phase 11–15 Verification

Issue tracking for remediation phases 11–15. Verdict remains **NO-GO** until production migrations, credential rotation, and remaining operational gates close.

| Field | Value |
|---|---|
| Date | 2026-07-20 |
| Workspace | `goldex-production` |
| Release verdict | **NO-GO** |

## Issue register

| Issue ID | Severity | Root cause | Files | Before / After | Tests | Results | Migration | Rollback | Status |
|---|---|---|---|---|---|---|---|---|---|
| P11-VAT | Blocker | Cart VAT collapsed; 24KT mixed with taxable | `purity.js`, `cartTotals.js`, `pricingCalculator.js`, `pricing.service.js`, `order.service.js`, FE order/invoice | Before: shared cart taxTreatment; After: per-line zero_rated/standard/exempt snapshots; coupon allocation; historical VAT immutable | `test/vat-cart.test.js` | Pass (mixed 24/22, coupons, purity aliases) | N/A | Revert pricing + order snapshot fields | **Verified** (automated; staging invoice UI matrix still recommended) |
| P11-RPT | High | Report refunds uncapped / negative | `report.service.js` | Before: raw refundedTotal; After: `min(max(refund,0), gross)` | `test/report.test.js` | Pass | N/A | Revert report.service | **Verified** |
| P11-SCH | High | Unsafe month arithmetic | `calendarMonths.js`, `scheme.service.js` | Before: `Date.UTC(y,m+n,d)`; After: calendar-safe clamp | `vat-cart` + `scheme.test.js` | Pass | N/A | Revert helper | **Verified** |
| P12-OTP | Blocker | Concurrent OTP send/verify races | `auth.service.js`, `auth.models.js` | Before: non-atomic create/consume; After: activeChallengeKey unique + retry; consume-once verify | `test/auth-concurrency.test.js` | Pass (re-run stable) | Index via migrate | Revert auth + drop challenge index | **Verified** |
| P12-REF | Blocker | Refresh rotation read-then-save | `auth.service.js` | Before: race reissue; After: atomic findOneAndUpdate revoke | `test/auth-concurrency.test.js` | Pass | N/A | Revert rotateSession | **Verified** |
| P13-RET | Blocker | Return qty over-reserve race | `return.service.js`, order item `reservedReturnQty` | Before: read-then-create; After: txn + reservedReturnQty invariant | `test/returns.test.js` | Pass concurrent | Backfill reservedReturnQty=0 | Revert return service | **Verified** |
| P13-PRF | High | Proof claim not transactional | `upload.service.js`, `return.service.js` | Before: separate claim; After: claim in same txn | returns + uploads | Pass | N/A | Revert claim helper | **Verified** |
| P13-UPL | High | Magic bytes only | `fileSignature.js` + sharp | Before: signature only; After: decode + PDF bounds | `file-signature.test.js`, `uploads.test.js` | Pass | N/A | Revert util; uninstall sharp | **Verified** |
| P14-VAR | Blocker | Multi-request variant edit | `catalog.service.js` aggregates, routes, `useAdminProducts.js` | Before: variant+adjust+delete/recreate stones; After: `/variants/complete` one txn | `test/catalog-aggregate.test.js` | Pass rollback + idempotency | N/A | Revert aggregate routes; FE fallback | **Verified** |
| P14-IMG | High | FE PATCH-all primary images | `setPrimaryImage` endpoint | Before: N PATCHes; After: one POST set-primary | catalog-aggregate concurrent | Pass | primary index migrate | Revert endpoint | **Verified** |
| P14-VAL | High | Many mutations lacked Zod | validators + routes (orders, cart, rates, coupons, users) | Before: DTO-only; After: Zod on key mutations + pagination query | suite green | Not every catalog CRUD body yet | N/A | Remove validate() wires | **Implemented** |
| P14-PAGE | High | Hidden 200/500 caps | pagination util, catalog hydrate, orders/customers/inventory lists, FE hooks | Before: limit 200 join; After: meta.page/limit/total/pages + hydrate products | catalog-aggregate page 5 | Pass record 201+ | N/A | Revert list helpers | **Implemented** (some admin UIs still client-filter within pages) |
| P15-RDY | High | Readiness incomplete | `health.service.js`, `health.test.js` | Before: weak S3/config; After: HeadBucket (test skip), OTP, critical indexes, 8s cache, timeouts, no secrets | `test/health.test.js` | Pass unit; prod HeadBucket not exercised | N/A | Revert health.service | **Implemented** |
| P15-IDX | Blocker | Indexes missing when autoIndex off | `scripts/migrate-indexes.js`, schemas, `test/migrate-indexes.test.js` | Before: 6 specs + `--force-duplicates`; After: full critical manifest, no force flag, exit 2 on blockers | `test/migrate-indexes.test.js` | Manifest vs syncIndexes | `migrate:indexes:dry` then apply | Drop named indexes only | **Implemented** (prod apply pending) |
| P15-WAL | Blocker | Wallet backfill unsafe | `scripts/backfill-wallet-accounts.js` | Before: `--allow-negative`; After: removed; blocks negatives/nonzero orphans; `TOTALS` JSON | Manual dry-run | Script hardened | `wallet:backfill:dry` / apply | Ledger untouched | **Implemented** (prod apply pending) |
| P15-CPN | High | Coupon backfill race / soft exit | `scripts/backfill-coupon-customer-usage.js` | Before: soft report; After: maintenance note, `REPORT` JSON, exit 2 | Manual dry-run | Script hardened | `coupon:backfill-usage:dry` / apply | Re-run backfill | **Implemented** (prod apply pending) |
| P15-MDL | Medium | `delete models.X` import-order risk | commerce/scheme models + import-order test | Before: delete-then-model; After: `models.X \|\| model(...)` | `test/model-import-order.test.js` | Pass | N/A | Revert exports | **Verified** |
| P15-FE | Medium | Dialog/Sheet ref + RR warnings | `dialog.jsx`, `sheet.jsx`, `App.jsx` | Before: plain Overlay; After: forwardRef + v7 flags | frontend npm test / build | Pass; Vite 6.4.2 | N/A | Revert FE | **Verified** |
| P15-DOC | Medium | Phase 11–15 evidence not tracked | verification docs, `.gitignore` | Docs updated; verdict NO-GO | N/A | Docs only | N/A | N/A | **Implemented** |

## Commands recorded (2026-07-20)

```bash
cd backend && npm run lint          # clean
cd backend && npm test              # 130 passed (23 files)
cd backend && npm audit --omit=dev  # 0 vulnerabilities
cd backend && npm audit             # 0 vulnerabilities
cd frontend && npm run lint         # clean
cd frontend && npm test             # 26 passed
cd frontend && npm run build        # OK (Vite 6.4.2)
cd frontend && npm audit --omit=dev # 0 vulnerabilities
cd frontend && npm audit            # 0 vulnerabilities
```

Targeted: `auth-concurrency`, `vat-cart`, `returns`, `catalog-aggregate`, `migrate-indexes`, `health`, `file-signature` — pass.

Ops only (do **not** run against production from this task):

```bash
cd backend && npm run migrate:indexes:dry
cd backend && npm run wallet:backfill:dry
cd backend && npm run coupon:backfill-usage:dry
```

## Open gates (still NO-GO)

1. Production `migrate:indexes` / wallet / coupon backfills not applied.
2. Credential rotation (`GOLDEX_CREDENTIAL_ROTATION.md`).
3. Remaining Zod coverage for every catalog CRUD body; some admin list UIs still partially client-filter.
4. Manual staging matrix + financial reconciliation + live S3 HeadBucket on staging/prod.
5. Reviewable commit/archive of the remediated tree.
