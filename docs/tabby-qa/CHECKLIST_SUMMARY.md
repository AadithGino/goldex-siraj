# Tabby full testing checklist — Goldex self-assessment

Reference: [Full testing checklist](https://docs.tabby.ai/pay-in-4-custom-integration/full-testing-checklist)

Status key: **Done** | **N/A** | **Ops** (needs staging keys / manual test / screenshot)

---

## 1. On-site messaging

| Item | Status | Notes |
|------|--------|--------|
| Tabby Promo on product page (PDP) | **Done** | `TabbySnippet` + `ProductPaymentOptions` with Tabby installment estimate |
| Tabby messaging on cart / quick view | **Done** | Compact `ProductPaymentOptions` |
| English + Arabic copy | **Done** | `product.json`, `checkout.json`, `orders.json` EN/AR |
| Tabby logo / brand assets | **Done** | `/payments/tabby.png`, checkout Tabby card |
| Amount passed to snippets matches checkout total | **Done** | Uses cart totals / product price (incl. fee formula in `tabby.js`) |

---

## 2. Tabby as a payment method

| Item | Status | Notes |
|------|--------|--------|
| Tabby shown when configured + online checkout on | **Done** | `getEnabledStorePaymentMethods`, bootstrap `tabby_configured` |
| Background pre-scoring before showing Tabby | **Done** | `POST /customer/orders/tabby/eligibility`; hides with EN/AR message |
| Pre-scoring reject (+971500000002) | **Ops** | Run on staging; screenshot `04-*` |
| Tabby hidden when not configured | **Done** | No keys → method not listed |
| Pay in 4 / installment messaging | **Done** | PDP + sidebar estimate `(total × 1.015) / 4` |

---

## 3. Checkout

| Item | Status | Notes |
|------|--------|--------|
| Session creation on place order (full payload) | **Done** | `createTabbyCheckout` → `POST /api/v2/checkout` |
| `lang` en / ar from storefront | **Done** | `normalizeTabbyLang` |
| Buyer + shipping from customer profile & address | **Done** | No placeholder buyer data |
| `buyer_history` / `order_history` | **Done** | From orders + wishlist |
| Redirect to Tabby HPP | **Done** | `checkout_url` from session |
| Success / cancel / failure URLs | **Done** | `merchant_urls` → order detail or checkout with query params |
| Cancel / fail: cart retained | **Done** | `tabbyCartRetained`; abandon endpoint |
| Cancel / fail user messages EN/AR | **Done** | `checkout:tabby.cancelled` / `failed` |
| Registered-only checkout | **Done** | `RequireCustomer` on checkout |

---

## 4. Payment verification & processing

| Item | Status | Notes |
|------|--------|--------|
| Retrieve payment before marking paid | **Done** | `finalizeTabbyPayment` |
| Capture after authorization | **Done** | `POST .../captures` idempotent `capture-{orderId}` |
| Webhook auth (custom header, not HMAC) | **Done** | `verifyTabbyWebhookAuth` |
| Webhook → verify → pay → capture | **Done** | `tabby.controller.js` async processing |
| Reconciliation worker retries capture | **Done** | `payment.reconciliation.service.js` |
| Corner case (close tab before redirect) | **Ops** | Webhook + reconciliation; record payment ID in `TEST_RUN_LOG.md` |
| Refunds via API (cancel / returns) | **Done** | `refundTabbyPayment` + wallet remainder |
| Refund idempotency (`reference_id`) | **Done** | Per refund event ids |
| Manual refund only in dashboard | **N/A** | Refunds initiated from **Goldex admin** (OMS), synced to Tabby API |

---

## Not applicable

| Item | Reason |
|------|--------|
| Mobile app WebView focus test (checklist §7) | Website only; no native app checkout |
| Tamara / other BNPL | Out of scope; Tabby only for BNPL |

---

## Code references

- Backend: `tabby.service.js`, `tabby.payment.service.js`, `tabby.controller.js`, `order.service.js`
- Frontend: `TabbySnippet.jsx`, `PaymentConfirm.jsx`, `CheckoutPage.jsx`, `useTabby.js`
- Tests: `backend/test/tabby.test.js`, `frontend/src/lib/tabby.test.js`
