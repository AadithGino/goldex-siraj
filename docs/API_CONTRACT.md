# Goldex API contract

All endpoints are rooted at `/api/v1`. Successful JSON responses use `{ "success": true, "data": ... }`; errors use `{ "success": false, "error": { "code", "message", "details"? } }`.

## Payment state rules

- `POST /customer/orders` creates an estimate and an unpaid order. It never creates reportable revenue.
- `POST /admin/orders/:id/cod-handover` requires a shipped COD order. In one MongoDB transaction it reads the current gold rates, ignores any fixed estimate, recalculates all lines, creates the invoice/payment event, marks paid, and marks delivered.
- `POST /admin/orders/:id/manual-payment` accepts only `bank_transfer` or `card` and requires `transaction_ref`. It recalculates at verification time and marks paid, but fulfillment remains separate.
- Reports use only `paymentStatus=paid` and `paidAt`; placement time is not a sales date.
- Completed returns credit the customer wallet with an idempotency key. COD refunds therefore remain wallet credits.

## Route groups

| Group | Main capabilities |
| --- | --- |
| `/customer/auth` | OTP send/verify, refresh, logout, profile |
| `/customer/catalog` | Products, variants, images, categories, brands, banners, certificates, CMS, settings/rates bootstrap |
| `/customer` | Pricing, cart, wishlist, addresses, coupons, orders, returns, wallet, reviews |
| `/customer/schemes` | Schemes and customer enrollments |
| `/staff/auth`, `/staff/orders` | Staff login and order operations |
| `/admin/catalog`, `/admin/rates`, `/admin/media` | Catalog, settings, rate history, and uploads |
| `/admin/orders`, `/admin/returns` | Fulfillment, payment verification, and wallet refunds |
| `/admin/reports` | Dashboard, paid-only sales, top paid products |
| `/admin` | Customers, staff, coupons, inventory, stock ledger, reviews, payment events, audit log |

Access and refresh tokens are delivered in HttpOnly cookies. Owner-only staff management and manager-or-owner financial/catalog mutations are enforced by middleware.
