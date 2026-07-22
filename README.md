# Goldex production application

This repository contains the React storefront/admin frontend and a new Express 5 + Node.js + Mongoose backend. The frontend no longer uses Supabase at runtime.

## Business behavior

- COD shows an estimate at checkout. The final price is computed from the live server-side gold rate only when staff confirms physical handover and cash collection.
- Bank transfer/card is coordinated outside the site. An owner or manager enters the transaction reference and marks the payment verified.
- Unpaid orders never count as sales.
- Completed return refunds are credited to the customer wallet.
- Staff roles remain `owner`, `manager`, and `staff`.
- Certificate uploads use the canonical `product-certificates` storage prefix.

## Local setup

1. Run MongoDB as a replica set (transactions are required).
2. Copy `backend/.env.example` to `backend/.env` and set strong JWT secrets.
3. Copy `frontend/.env.example` to `frontend/.env`.
4. In `backend`, run `npm ci`, then `npm run create-owner` with `OWNER_EMAIL`, `OWNER_PASSWORD`, and optionally `OWNER_NAME` set.
5. Run `npm run dev` in both `backend` and `frontend`.

The included Compose stack starts a single-node Mongo replica set, API, and frontend on port 8080.

## Production gates

Before release, configure a real HTTPS OTP provider (`OTP_PROVIDER=http`, `OTP_PROVIDER_URL`, `OTP_PROVIDER_API_KEY`), TLS/reverse proxy, persistent S3-compatible storage or a durable uploads volume, backups, monitoring, and the first owner account. Production startup intentionally refuses the console OTP provider or development JWT secrets.

Run `npm run check` from the repository root before deploying. See [API_CONTRACT.md](docs/API_CONTRACT.md) for route and accounting rules.
