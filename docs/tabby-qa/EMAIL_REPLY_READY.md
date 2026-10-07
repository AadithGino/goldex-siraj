Subject: Goldex Tabby integration — self-test summary & QA materials

Hello Mariia,

Thank you for the checklist and testing guidelines. We completed a self-review against the [full testing checklist](https://docs.tabby.ai/pay-in-4-custom-integration/full-testing-checklist) and prepared screenshots and session payload examples for your QA session.

### Platform & store

- **Website only** (responsive SPA). We do not have native iOS/Android store apps.
- **Country / currency:** United Arab Emirates, **AED**.
- **Checkout:** **Registered users only** (phone OTP). Guest checkout is not offered.
- **Staging API:** https://goldex.retailkerala.com/api/v1  
- **Storefront for QA:** We are finalizing deployment of the SPA to **https://goldex.retailkerala.com** (the API is already live on this host). Until that cutover, we validated the Tabby UI on our dev storefront against the same catalog and payment stack; screenshots are attached from that environment.
- **Merchant code:** **TLAE**

**Test accounts for your team**

| Use case | Phone | Email on profile |
|----------|-------|------------------|
| Success, cancel, corner case | +971500000001 | otp.success@tabby.ai |
| Background pre-scoring reject | +971500000002 | otp.success@tabby.ai |
| HPP rejection | +971500000001 | otp.rejected@tabby.ai |

Sign in via phone OTP on the storefront. Please save a **UAE delivery address** before checkout (required for Tabby). Tabby HPP OTP in test mode: **8888**.

### Checklist summary (four areas)

1. **On-site messaging** — Tabby promo / installment messaging on product page, cart, and checkout sidebar in **English and Arabic**, aligned to order totals.

2. **Tabby as a payment method** — Tabby at checkout when enabled; background pre-scoring via our eligibility API hides Tabby with the approved EN/AR message when Tabby rejects (e.g. test phone +971500000002). Screenshots attached.

3. **Checkout** — Full Tabby session on place order (buyer, shipping, items, buyer/order history, `lang`, merchant URLs) and redirect to Tabby HPP. Cancel/failure return to checkout with cart preserved and localized copy.

4. **Payment verification & processing** — On success we retrieve the payment, mark the order paid, then capture with idempotent reference `capture-{orderId}`. Webhooks authenticate via our registered custom header **`X-Goldex-Tabby-Auth`**. Reconciliation retries capture (corner case: customer closes tab before redirect). Refunds from our **admin OMS** via Tabby Refund API.

**Not applicable:** native mobile app WebView tests (website only).

### Scenarios & payment IDs

We will paste payment IDs from the Tabby Merchant Dashboard immediately after re-running the five scenarios on staging with refreshed test keys (our current test secret returned HTTP 401 on session create — we are confirming credentials with Tabby). Pre-scoring reject is verified in UI (no payment id).

| Scenario | Payment ID |
|----------|------------|
| Success | _To be added after HPP run_ |
| Pre-scoring reject | N/A |
| Cancellation | _To be added after HPP run_ |
| HPP failure / rejection | _To be added after HPP run_ |
| Corner case | _To be added after HPP run_ |

### Attachments

- **tabby-qa-screenshots.zip** — Product, cart, checkout (Tabby + reject), cancel/failure pages — EN & AR  
- **example-checkout-session-body.json** — sample `POST /api/v2/checkout` body (no secrets)

### Webhook

- **URL:** `https://goldex.retailkerala.com/api/v1/webhooks/tabby`  
- **Header:** `X-Goldex-Tabby-Auth: <shared secret registered in Tabby dashboard>`

### Refunds

We refund from **our admin** (cancellations and approved returns); Tabby’s Refund API is called automatically. We do not rely on manual dashboard refunds for normal operations.

Please confirm receipt and let us know if you need a dedicated staging URL once our SPA deploy is live.

Best regards,  
[Your name]  
THE GOLDEX JEWELLERY L.L.C
