# Tabby QA round 1 — fixes (Mariia feedback)

## Code changes

| Issue | Fix |
|-------|-----|
| Duplicate Tabby installment copy on PDP/cart | Removed custom strings; **only** official `TabbyPromo` snippet in `ProductPaymentOptions` |
| Snippet disappears on language switch | `TabbySnippet` remounts on `lang` + price (`containerId` includes lang, React `key`) |
| Outdated Tabby logo | Storefront uses `/payments/tabby-logo.png` (replace from [brand kit](https://drive.google.com/drive/folders/1FP7tvXEouH0Op4B43iELtVeR2PhU96Hq)) |
| Tabby blocked without profile email | Backend omits `buyer.email` when empty; pre-scoring no longer requires email |
| `merchant_urls` / `product_url` → localhost | `STOREFRONT_URL` + `resolveStorefrontOrigin()` for Tabby session URLs |
| Webhooks not registered | Ops: run `node backend/scripts/tabby-register-webhook.js` with production `.env` |
| Poll storm on EXPIRED payments | Terminal `tabbyPaymentStatus`; reconciliation waits 30m for webhook, **one** fallback retrieve; excludes terminal orders |
| Stale August/September pending orders | `node backend/scripts/tabby-mark-stale-pending.js --apply` on production DB (once) |

## Production deploy checklist

1. **API `.env`**
   - `STOREFRONT_URL=https://www.goldexjewellery.ae`
   - `CLIENT_ORIGINS=https://www.goldexjewellery.ae` (and `https://goldexjewellery.ae` if you serve both)
   - `API_PUBLIC_URL=https://goldex.retailkerala.com`
   - `TABBY_MERCHANT_CODE=TLAE`, test/live keys as appropriate
   - `TABBY_WEBHOOK_SECRET` + `TABBY_WEBHOOK_HEADER_NAME=X-Goldex-Tabby-Auth`

2. **Register webhook** (once per merchant code):
   ```bash
   node backend/scripts/tabby-register-webhook.js
   ```

3. **Mark ancient pending Tabby orders** (stops retrieve loops immediately):
   ```bash
   node backend/scripts/tabby-mark-stale-pending.js --apply
   ```

4. **Frontend**: deploy build; drop new `tabby-logo.png` into `public/payments/`.

5. **Test orders** ORD-2026-0000043–45: cancel in admin as needed.
