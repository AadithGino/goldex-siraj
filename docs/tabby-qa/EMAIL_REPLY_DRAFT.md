# Draft reply to Tabby (Mariia Vazenmiller)

Copy, replace `_FILL_` placeholders, attach `tabby-qa-screenshots.zip` and `example-checkout-session-body.json`.

---

**Subject:** Goldex Tabby integration — self-test summary & QA materials

Hello Mariia,

Thank you for the checklist and testing guidelines. We completed a self-review against the [full testing checklist](https://docs.tabby.ai/pay-in-4-custom-integration/full-testing-checklist) and ran the scenarios below on our staging environment with Tabby test keys.

### Platform & store

- **Website only** (responsive web app). We do not have native iOS/Android store apps.
- **Country / currency:** United Arab Emirates, **AED**.
- **Checkout:** **Registered users only** (phone OTP login). Guest checkout is not offered.
- **Staging URL for QA:** _FILL_STOREFRONT_URL_ (e.g. https://goldex.retailkerala.com)
- **Merchant code(s):** _FILL_MERCHANT_CODE_

**Test account for your team**

- Phone: _FILL_PHONE_
- How to sign in: _FILL_(e.g. request OTP on login; staging may show test OTP in UI only in non-production)
- Please add a delivery address in the account before checkout (required for Tabby).

### Checklist summary (four areas)

1. **On-site messaging** — Implemented Tabby promo/card snippets on the product page, cart/checkout sidebar, and quick view, in **English and Arabic**, with installment messaging aligned to the order amount.

2. **Tabby as a payment method** — Tabby appears at checkout when enabled and passes background pre-scoring (`POST /customer/orders/tabby/eligibility`). When pre-scoring rejects (e.g. test phone +971500000002), Tabby is hidden with the approved EN/AR unavailable message.

3. **Checkout** — Placing an order with Tabby creates a full Tabby checkout session (buyer, shipping, items, buyer/order history, `lang`, merchant URLs) and redirects to Tabby HPP. Cancel and failure return to our checkout with the cart preserved and localized messaging.

4. **Payment verification & processing** — On success we **retrieve** the payment from Tabby, mark the order paid, then **capture** with idempotent reference `capture-{orderId}`. Webhooks use our registered **custom header** (not HMAC). A reconciliation worker retries capture if needed (corner case: customer closes the tab before redirect). **Refunds** are processed from our admin OMS (order cancellation and approved returns) via Tabby’s Refund API; remaining balance may go to the customer wallet.

Items marked **not applicable:** native mobile app WebView tests (website only).

Detailed line-by-line mapping: see attached `CHECKLIST_SUMMARY.md` in our repo / zip.

### Scenarios run (payment IDs)

| Scenario | Payment ID |
|----------|------------|
| Success | _FILL_ |
| Pre-scoring reject | N/A (no payment created) |
| Cancellation | _FILL_or_NA_ |
| HPP failure / rejection | _FILL_ |
| Corner case (close tab after success) | _FILL_ |

### Attachments

- Screenshots: product, cart/sidebar, checkout (Tabby selected + pre-scoring reject), success / cancel / failure pages — **EN and AR** (see zip).
- Example session creation body (no secrets): `example-checkout-session-body.json`

### Refunds

We refund **from our side** (admin order cancel and return approval). Refunds call Tabby’s API automatically; we do not rely on manual dashboard refunds for normal operations.

Please let us know if you need anything else before your QA session.

Best regards,  
_FILL_NAME_  
_FILL_ROLE_ — THE GOLDEX JEWELLERY L.L.C
