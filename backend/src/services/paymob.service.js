import crypto from "node:crypto";
import { config } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

export function getPaymobConfig() {
  const baseUrl = normalizeBaseUrl(config.paymob.baseUrl);
  const integrationId = Number(config.paymob.integrationId);
  const isConfigured = Boolean(
    config.paymob.enabled &&
    baseUrl &&
    config.paymob.secretKey &&
    config.paymob.publicKey &&
    config.paymob.hmacSecret &&
    Number.isFinite(integrationId) &&
    integrationId > 0,
  );
  return {
    ...config.paymob,
    baseUrl,
    integrationId,
    isConfigured,
  };
}

export function buildCheckoutUrl(clientSecret) {
  const cfg = getPaymobConfig();
  if (!cfg.isConfigured) {
    throw new AppError(
      503,
      "PAYMOB_NOT_CONFIGURED",
      "Online payment is not configured",
    );
  }
  const params = new URLSearchParams({
    publicKey: cfg.publicKey,
    clientSecret,
  });
  return `${cfg.baseUrl}/unifiedcheckout/?${params.toString()}`;
}

/**
 * Paymob `special_reference` / `merchant_order_id` → Goldex Mongo order id.
 * Supports bare ObjectIds and unique attempt refs like `{orderId}_{timestamp}`.
 */
export function resolveGoldexOrderId(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (/^[a-f\d]{24}$/i.test(value)) return value.toLowerCase();
  const match = value.match(/^([a-f\d]{24})(?:[_-].+)?$/i);
  return match ? match[1].toLowerCase() : null;
}

/** Unique per checkout attempt — Paymob rejects reused merchant_order_id / special_reference. */
export function buildPaymobSpecialReference(orderId) {
  const id = String(orderId || "").trim();
  if (!/^[a-f\d]{24}$/i.test(id)) {
    throw new AppError(
      422,
      "INVALID_ORDER_ID",
      "Invalid order id for Paymob reference",
    );
  }
  return `${id}_${Date.now()}`;
}

function splitName(fullName = "") {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    firstName: parts[0] || "Customer",
    lastName: parts.slice(1).join(" ") || "Goldex",
  };
}

function billingDataFromOrder(order, customer) {
  const shipTo = order.shipTo || {};
  const { firstName, lastName } = splitName(
    shipTo.recipientName || customer?.fullName,
  );
  const phone =
    String(shipTo.phone || customer?.phone || "").trim() || "+971500000000";
  const email = String(customer?.email || "customer@goldex.ae").trim();
  const line1 = String(shipTo.line1 || shipTo.line_1 || "Dubai").trim();
  return {
    first_name: firstName.slice(0, 50),
    last_name: lastName.slice(0, 50),
    phone_number: phone.slice(0, 40),
    email: email.slice(0, 200),
    apartment: "NA",
    floor: "NA",
    street: line1.slice(0, 100) || "NA",
    building: "NA",
    city: String(shipTo.city || "Dubai").slice(0, 50) || "Dubai",
    state:
      String(shipTo.emirate || shipTo.state || "Dubai").slice(0, 50) || "Dubai",
    country: "ARE",
    postal_code: String(
      shipTo.postalCode || shipTo.postal_code || "00000",
    ).slice(0, 20),
    shipping_method: "PKG",
  };
}

function hmacFieldString(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  const raw = String(value);
  if (/^(true|false)$/i.test(raw)) return raw.toLowerCase();
  return raw;
}

function hmacHex(secret, parts) {
  const payload = parts.map(hmacFieldString).join("");
  return crypto.createHmac("sha512", secret).update(payload).digest("hex");
}

function timingSafeEqualHex(a, b) {
  const expected = String(a || "")
    .trim()
    .toLowerCase();
  const received = String(b || "")
    .trim()
    .toLowerCase();
  if (!expected || !received || expected.length !== received.length)
    return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function uniqueNonEmpty(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const key = String(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export async function createPaymobIntention({
  order,
  customer,
  specialReference = null,
}) {
  const cfg = getPaymobConfig();
  if (!cfg.isConfigured) {
    throw new AppError(
      503,
      "PAYMOB_NOT_CONFIGURED",
      "Online payment is not configured",
    );
  }

  const amountDue = Math.max(0, Number(order.amountDue ?? order.total ?? 0));
  const amountCents = Math.round(amountDue * 100);
  if (amountCents < 100) {
    throw new AppError(
      422,
      "PAYMOB_MIN_AMOUNT",
      "Online payment requires at least AED 1.00",
    );
  }

  const appOrigin = config.clientOrigins[0] || "http://localhost:5173";
  const apiOrigin = config.publicApiUrl.replace(/\/+$/, "");
  const reference = specialReference || buildPaymobSpecialReference(order.id);

  const items = (order.items || []).slice(0, 20).map((item, index) => {
    const qty = Math.max(1, Number(item.qty) || 1);
    const lineTotal = Number(item.lineTotal ?? item.unitPrice ?? 0);
    const unitCents = Math.max(1, Math.round((lineTotal / qty) * 100));
    return {
      name: String(item.productName || item.name || `Item ${index + 1}`).slice(
        0,
        100,
      ),
      amount: unitCents,
      quantity: qty,
    };
  });
  if (!items.length) {
    items.push({
      name: String(order.orderNumber || "Goldex order").slice(0, 100),
      amount: amountCents,
      quantity: 1,
    });
  }

  const body = {
    amount: amountCents,
    currency: cfg.currency,
    payment_methods: [cfg.integrationId],
    items,
    billing_data: billingDataFromOrder(order, customer),
    special_reference: reference,
    extras: {
      order_number: order.orderNumber,
      goldex_order_id: String(order.id),
    },
    notification_url: `${apiOrigin}/api/v1/webhooks/paymob`,
    redirection_url: `${appOrigin}/orders/${order.id}?payment=return`,
    expiration: 1800,
  };

  const response = await fetch(`${cfg.baseUrl}/v1/intention/`, {
    method: "POST",
    headers: {
      Authorization: `Token ${cfg.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail || data?.message || JSON.stringify(data);
    throw new AppError(
      502,
      "PAYMOB_INTENTION_FAILED",
      `Paymob checkout could not be started: ${detail}`,
    );
  }
  if (!data?.client_secret) {
    throw new AppError(
      502,
      "PAYMOB_INTENTION_FAILED",
      "Paymob did not return a client secret",
    );
  }

  return {
    intentionId: String(data.id),
    paymobOrderId:
      data.intention_order_id != null ? String(data.intention_order_id) : null,
    clientSecret: data.client_secret,
    checkoutUrl: buildCheckoutUrl(data.client_secret),
    specialReference: reference,
  };
}

/** Server-to-server Transaction Processed callback (body.obj + ?hmac=). */
export function verifyPaymobTransactionHmac(obj, hmac) {
  const cfg = getPaymobConfig();
  if (!cfg.hmacSecret || !hmac || !obj) return false;

  const digest = hmacHex(cfg.hmacSecret, [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    obj.error_occured,
    obj.has_parent_transaction,
    obj.id,
    obj.integration_id,
    obj.is_3d_secure,
    obj.is_auth,
    obj.is_capture,
    obj.is_refunded,
    obj.is_standalone_payment,
    obj.is_voided,
    obj.order?.id,
    obj.owner,
    obj.pending,
    obj.source_data?.pan,
    obj.source_data?.sub_type,
    obj.source_data?.type,
    obj.success,
  ]);
  return timingSafeEqualHex(digest, hmac);
}

/**
 * Query parsers turn `+` into space, so Paymob `created_at=...+04:00` becomes `... 04:00`.
 */
export function normalizePaymobCreatedAt(value) {
  const raw = String(value ?? "");
  if (!raw) return raw;
  return raw.replace(
    /T(\d{2}:\d{2}:\d{2}(?:\.\d+)?) ([0-9]{2}:[0-9]{2})$/,
    "T$1+$2",
  );
}

function pickRedirectField(query, ...keys) {
  for (const key of keys) {
    if (
      query[key] !== undefined &&
      query[key] !== null &&
      String(query[key]) !== ""
    ) {
      return query[key];
    }
  }
  return "";
}

function redirectFieldVariants(query, ...keys) {
  const values = uniqueNonEmpty(keys.map((key) => query[key]));
  return values.length ? values : [""];
}

/**
 * Browser redirect callback uses flattened query params.
 * Docs: GET uses `order_id` + dotted `source_data.*`; some regions also send `order` / underscored keys.
 */
export function verifyPaymobRedirectHmac(query = {}) {
  const cfg = getPaymobConfig();
  const hmac = query.hmac;
  if (!cfg.hmacSecret || !hmac) return false;

  const createdAts = uniqueNonEmpty([
    normalizePaymobCreatedAt(query.created_at),
    query.created_at,
  ]);
  const orderIds = redirectFieldVariants(query, "order_id", "order");
  const pans = redirectFieldVariants(
    query,
    "source_data.pan",
    "source_data_pan",
  );
  const subTypes = redirectFieldVariants(
    query,
    "source_data.sub_type",
    "source_data_sub_type",
  );
  const types = redirectFieldVariants(
    query,
    "source_data.type",
    "source_data_type",
  );

  for (const createdAt of createdAts) {
    for (const orderId of orderIds) {
      for (const pan of pans) {
        for (const subType of subTypes) {
          for (const type of types) {
            const digest = hmacHex(cfg.hmacSecret, [
              pickRedirectField(query, "amount_cents"),
              createdAt,
              pickRedirectField(query, "currency"),
              pickRedirectField(query, "error_occured"),
              pickRedirectField(query, "has_parent_transaction"),
              pickRedirectField(query, "id"),
              pickRedirectField(query, "integration_id"),
              pickRedirectField(query, "is_3d_secure"),
              pickRedirectField(query, "is_auth"),
              pickRedirectField(query, "is_capture"),
              pickRedirectField(query, "is_refunded"),
              pickRedirectField(query, "is_standalone_payment"),
              pickRedirectField(query, "is_voided"),
              orderId,
              pickRedirectField(query, "owner"),
              pickRedirectField(query, "pending"),
              pan,
              subType,
              type,
              pickRedirectField(query, "success"),
            ]);
            if (timingSafeEqualHex(digest, hmac)) return true;
          }
        }
      }
    }
  }

  return false;
}

/** Legacy Accept auth token (required for transaction inquiry). */
export async function createPaymobAuthToken() {
  const cfg = getPaymobConfig();
  if (!cfg.apiKey) return null;

  const response = await fetch(`${cfg.baseUrl}/api/auth/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: cfg.apiKey }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.token) return null;
  return String(data.token);
}

/**
 * Pull authoritative transaction status from Paymob (webhook / HMAC fallback).
 */
export async function inquirePaymobTransaction({
  transactionId = null,
  merchantOrderId = null,
  paymobOrderId = null,
} = {}) {
  const cfg = getPaymobConfig();
  const token = await createPaymobAuthToken();

  if (transactionId) {
    if (token) {
      const response = await fetch(
        `${cfg.baseUrl}/api/acceptance/transactions/${encodeURIComponent(String(transactionId))}?token=${encodeURIComponent(token)}`,
      );
      const data = await response.json().catch(() => null);
      if (response.ok && data?.id != null) return data;
    }

    // Some Intention accounts accept Secret Key for read APIs.
    if (cfg.secretKey) {
      const response = await fetch(
        `${cfg.baseUrl}/api/acceptance/transactions/${encodeURIComponent(String(transactionId))}`,
        { headers: { Authorization: `Token ${cfg.secretKey}` } },
      );
      const data = await response.json().catch(() => null);
      if (response.ok && data?.id != null) return data;
    }
  }

  if (!token || (!merchantOrderId && !paymobOrderId)) return null;

  for (const path of [
    "/api/ecommerce/orders/transaction_inquiry",
    "/api/acceptance/transactions/transaction_inquiry",
  ]) {
    const response = await fetch(`${cfg.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: token,
        ...(merchantOrderId
          ? { merchant_order_id: String(merchantOrderId) }
          : {}),
        ...(paymobOrderId ? { order_id: String(paymobOrderId) } : {}),
      }),
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.id != null) return data;
  }

  return null;
}

export function paymobTransactionBelongsToOrder(
  txn,
  order,
  { inquiredByMerchantRef = false } = {},
) {
  if (!txn || !order) return false;
  const orderId = String(order.id);

  const merchantRef = resolveGoldexOrderId(
    txn.order?.merchant_order_id || txn.merchant_order_id,
  );
  if (merchantRef) return merchantRef === orderId;

  const txnPaymobOrderId =
    txn.order?.id ??
    (typeof txn.order === "number" || typeof txn.order === "string"
      ? txn.order
      : null);
  if (order.paymobOrderId && txnPaymobOrderId != null) {
    return String(txnPaymobOrderId) === String(order.paymobOrderId);
  }

  // Inquiry was made with this order's special_reference; Paymob returned this txn for that ref.
  return Boolean(inquiredByMerchantRef && order.paymobSpecialReference);
}

export function isPaymobSuccessFlag(value) {
  return (
    value === true ||
    value === "true" ||
    value === "True" ||
    value === 1 ||
    value === "1"
  );
}

export function isPaymobPendingFlag(value) {
  return (
    value === true ||
    value === "true" ||
    value === "True" ||
    value === 1 ||
    value === "1"
  );
}
