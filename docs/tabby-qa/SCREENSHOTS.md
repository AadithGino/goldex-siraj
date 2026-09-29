# Tabby QA — screenshot checklist

Save files under `docs/tabby-qa/screenshots/` using these names so they can be zipped and attached to the email.

**Languages:** English (`/en` or default) and Arabic (`/ar` or site language switcher).

**Viewport:** capture desktop **1440×900** (or full-width) unless noted; add one **mobile 390×844** set optional if Tabby asks.

| # | Scenario | EN filename | AR filename |
|---|----------|-------------|-------------|
| 1 | Product page — Tabby promo / payment options (price visible) | `01-en-product.png` | `01-ar-product.png` |
| 2 | Cart or checkout sidebar — compact Tabby / 4 installments | `02-en-cart-or-sidebar.png` | `02-ar-cart-or-sidebar.png` |
| 3 | Checkout — payment step, Tabby selected (logo + method) | `03-en-checkout-tabby.png` | `03-ar-checkout-tabby.png` |
| 4 | Checkout — Tabby **unavailable** (pre-scoring reject phone `+971500000002`) | `04-en-checkout-tabby-hidden.png` | `04-ar-checkout-tabby-hidden.png` |
| 5 | After **success** — order thank-you / order detail paid | `05-en-success.png` | `05-ar-success.png` |
| 6 | After **cancel** — checkout with cancel message, cart retained | `06-en-cancelled.png` | `06-ar-cancelled.png` |
| 7 | After **failure** — checkout with failure message | `07-en-failed.png` | `07-ar-failed.png` |

### How to capture quickly

1. Deploy staging with `TABBY_ENABLED=true` and **test keys** (`sk_test_…` / `pk_test_…`).
2. Enable **online checkout** + Tabby in admin store settings (if exposed) or ensure bootstrap shows `tabby_configured: true`.
3. Use Tabby test credentials from [Testing credentials](https://docs.tabby.ai/testing-guidelines/testing-credentials) (OTP always **8888**).
4. Switch language before each AR shot (header language toggle).

```bash
cd docs/tabby-qa/screenshots
zip -r ../tabby-qa-screenshots.zip .
```
