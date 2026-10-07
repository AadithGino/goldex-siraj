**Subject:** Re: Goldex (`TLAE`) — example session payload for HTTP 401

Hello Mariia,

Thank you for your reply.

Below is the **exact request** our backend sends when checkout fails with **401** (response body was empty / `null` in our logs). We have **not** included secret keys in this email; they are sent only in the `Authorization` header as issued to us.

---

### Request that returns 401

**Method / URL:** `POST https://api.tabby.ai/api/v2/checkout`

**Headers:**

| Header | Value |
|--------|--------|
| `Authorization` | `Bearer sk_test_019f992d-****-****-****-e6aafaeddc7d` *(full key as issued to us — available on request via secure channel if needed)* |
| `X-Merchant-Code` | `TLAE` |
| `Content-Type` | `application/json` |

**Response we receive:** `HTTP 401`, body empty or not JSON.

**JSON body:** see attached file **`tabby-401-checkout-example.json`** (same structure as below).

```json
(paste contents of tabby-401-checkout-example.json)
```

---

### Same 401 on webhook registration

We also receive **401** on:

**`POST https://api.tabby.ai/api/v1/webhooks`**

With headers:

- `Authorization: Bearer sk_test_019f992d-****-****-****-e6aafaeddc7d`
- `X-Merchant-Code: TLAE`
- `Content-Type: application/json`

Body (example):

```json
{
  "url": "https://goldex.retailkerala.com/api/v1/webhooks/tabby",
  "header": {
    "title": "X-Goldex-Tabby-Auth",
    "value": "<our-generated-secret>"
  }
}
```

---

### Webhooks

Understood — we will register webhooks **only** via the API as documented at [Register a webhook](https://docs.tabby.ai/api-reference/webhooks/register-a-webhook), using a custom `header.title` / `header.value` pair and verifying that header on incoming notifications. We will proceed once checkout session creation succeeds with valid credentials.

Please let us know if the merchant code, key pair, or request shape should be adjusted on our side.

Best regards,  
[Your name]  
THE GOLDEX JEWELLERY L.L.C  
[Email] | [Phone]
