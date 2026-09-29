# Tabby QA — test run log (fill before sending email)

Run on **staging** with Tabby **test keys** only. Copy payment IDs from [Tabby Merchant Dashboard](https://merchant.tabby.ai/) after each run.

| Scenario | Tabby test identity | Steps done (Y/N) | Payment ID | Order # (Goldex) | Notes |
|----------|---------------------|------------------|------------|------------------|-------|
| 1. Success | Email `otp.success@tabby.ai`, phone **+971500000001**, OTP **8888** | | | | Expect `CLOSED` + capture ref `capture-{orderId}` |
| 2. Pre-scoring reject | Same email, phone **+971500000002** | | N/A (no payment) | | Tabby hidden / unavailable message on checkout |
| 3. Cancellation | Success credentials, cancel on HPP | | | | Cart kept; cancel copy on checkout |
| 4. HPP failure | Email `otp.rejected@tabby.ai`, phone **+971500000001**, OTP **8888** | | | | `REJECTED`; failure message on checkout |
| 5. Corner case | Success credentials, close tab after Tabby success tick | | | | Order paid via webhook/reconciliation + capture |
| 6. Refund (API) | Paid Tabby order → admin cancel or return | | | | Refund in dashboard; idempotent `reference_id` |

### Retrieve payment (verify status)

```bash
curl -s "https://api.tabby.ai/api/v2/payments/<PAYMENT_ID>" \
  -H "Authorization: Bearer <TABBY_SECRET_KEY>" | jq '.status, .captures, .refunds'
```

### Webhook (staging)

- URL: `{API_PUBLIC_URL}/api/v1/webhooks/tabby`
- Auth: header `{TABBY_WEBHOOK_HEADER_NAME}: {TABBY_WEBHOOK_SECRET}` (register exact pair in Tabby webhook settings)
