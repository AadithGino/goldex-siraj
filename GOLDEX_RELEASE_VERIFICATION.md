# Goldex Release Verification

**Verdict: NO-GO** — do not cut over production traffic until the open gates below are closed.

| Field | Value |
|---|---|
| Date | 2026-07-22 |
| Workspace | `goldex-production` |
| Working tree | Phases 19–22.8 remediation in code; **not committed** |
| Backend | **304 passed / 0 failed / 0 skipped** (34 files, `--no-file-parallelism`) |
| Frontend | **95 passed / 0 failed / 0 skipped** (29 files); build OK |
| Dedicated 22.8 | BE **19** + FE **9** passed |
| Dedicated 22.7/22.7A catalog contract | **16 passed** (MongoMemoryReplSet) |
| Primary-image backfill suite | **8 passed** |
| Dedicated scheme suites | contract **11** + scheme **6** = **17 passed** |
| Audits | BE + FE `npm audit` / `--omit=dev`: **0 vulnerabilities** |
| `npm ci` | **Fails** in nested FE/BE workspace — not clean-install CI |
| Trackers | `GOLDEX_PHASE_22_CONTRACT_REPAIR.md`, earlier phase docs |

## Phase 22 (contract repair)

| Area | Status |
|---|---|
| Product / category / brand (22.2–22.4) | **Code tested** |
| Coupon + Dubai TZ (22.5 + 22.5A) | **Code tested** |
| Scheme pay / enroll / complete (22.6 + 22.6A) | **Code tested** through 22.6A; staging pending |
| Banner / certificate / CMS / images + XSS (22.7) | **Code tested** — not Verified (staging pending) |
| Primary-image index + reconciliation (22.7A) | **Code tested**; index **not applied** to staging/production |
| Admin/customer certificate pagination + Dubai dates (22.7A) | **Code tested** |
| Variant / stone / inventory (22.8) | **Code tested** — staging checklist pending |
| Manual staging confirmation | **Pending** |
| Clean release packaging | **Blocker** |

## New index (22.7 — not applied)

- `productimages_primary_unique` on `productimages` `{ productId: 1 }` unique partial `{ isPrimary: true }`
- Safe order: `products:backfill-primary-images:dry` → `migrate:indexes:dry` → approve → apply backfill → `migrate:indexes`

## Dry-run scripts created (not executed on production)

```
cd backend
npm run stones:audit-pricing:dry
npm run products:backfill-primary-images:dry
npm run migrate:indexes:dry
```

## Open gates (block GO)

1. Staging smoke: banners, certificates, CMS, images, schemes, coupons, **variant/stone/inventory 22.8 checklist**.
2. Production/staging index apply + primary-image reconciliation + scheme payment-ref backfill (dry-run first) after GO.
3. Scheme cancellation refund product decision.
4. Credential rotation (`GOLDEX_CREDENTIAL_ROTATION.md`).
5. Archive hygiene / `package:release`.
6. Wallet reconciliation; live S3 HeadBucket.
7. Optional: review `stones:audit-pricing:dry` report before any stone backfill (none executed in 22.8).

## Do not

- Deploy or run production migrations from this workspace without an explicit GO.
- Treat automated tests alone as Verified.
- Convert Zod schemas to `.passthrough()`.
- Produce another release ZIP until packaging hygiene is fixed.
- Mark overall release GO merely because local tests pass.
