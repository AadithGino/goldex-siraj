import { Link, useParams, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "sonner";
import { ChevronLeft, Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RequireCustomer } from "@/components/auth/RequireCustomer";
import { OrderTimeline } from "@/components/account/OrderTimeline";
import {
  useOrder,
  usePaymobCheckout,
  usePaymobConfirm,
  useChangeOrderPayment,
} from "@/hooks/useOrders";
import { formatINR } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ORDER_STATUS_VARIANT } from "@/lib/constants";
import {
  getOrderStatusLabel,
  getPaymentModeLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
} from "@/lib/i18nLabels";
import { ReturnRequest } from "@/components/account/ReturnRequest";
import {
  OrderItemsList,
  OrderRequestBadges,
} from "@/components/orders/OrderShared";
import { InvoiceNumber } from "@/components/shared/InvoiceNumber";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { formatDateSafe } from "@/lib/date";
import { isEstimatedPricing, orderDisplayTotal } from "@/lib/orderAdapter";
import { openOrderInvoice } from "@/lib/orderInvoice";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { getContentLang } from "@/lib/contentLocale";
import { tabbyReasonFromError, tabbyUnavailableMessage } from "@/lib/tabby";

function OrderDetailContent() {
  const { t, i18n } = useTranslation(["orders", "common", "checkout"]);
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: order, isLoading, error, refetch, isFetching } = useOrder(id);
  const { data: storeSettings } = useStoreSettings();
  const paymobCheckout = usePaymobCheckout();
  const paymobConfirm = usePaymobConfirm();
  const changePayment = useChangeOrderPayment();

  useEffect(() => {
    const payment = searchParams.get("payment");
    const successRaw = String(searchParams.get("success") || "").toLowerCase();
    const isCancelledReturn =
      payment === "cancelled" ||
      payment === "failed" ||
      successRaw === "false" ||
      successRaw === "0";
    if (isCancelledReturn) {
      const fromTabby = searchParams.get("provider") === "tabby";
      toast.message(
        fromTabby
          ? t(payment === "failed" ? "checkout:tabby.failed" : "checkout:tabby.cancelled")
          : t("orders:paymentNotCompleted"),
      );
      setSearchParams({}, { replace: true });
      refetch();
      return;
    }
    const hasPaymobResult = searchParams.get("id") && searchParams.get("hmac");
    const isTabbyReturn =
      payment === "return" &&
      (
        searchParams.get("provider") === "tabby" ||
        searchParams.get("payment_id") ||
        searchParams.get("checkout_id") ||
        searchParams.get("status")
      );
    const shouldConfirm = Boolean(hasPaymobResult || isTabbyReturn);
    if (payment !== "return" && !shouldConfirm) return;

    let cancelled = false;
    const run = async () => {
      // URLSearchParams turns `+` into space (breaks Paymob created_at timezone HMAC).
      // Parse the raw query with decodeURIComponent so literal `+` is preserved.
      const params = {};
      const raw = String(window.location.search || "").replace(/^\?/, "");
      for (const part of raw.split("&")) {
        if (!part) continue;
        const eq = part.indexOf("=");
        const rawKey = eq >= 0 ? part.slice(0, eq) : part;
        const rawVal = eq >= 0 ? part.slice(eq + 1) : "";
        let key;
        let value;
        try {
          key = decodeURIComponent(rawKey);
        } catch {
          key = rawKey;
        }
        try {
          value = decodeURIComponent(rawVal);
        } catch {
          value = rawVal;
        }
        params[key] = value;
      }
      if (typeof params.created_at === "string") {
        params.created_at = params.created_at.replace(
          /T(\d{2}:\d{2}:\d{2}(?:\.\d+)?) (\d{2}:\d{2})$/,
          "T$1+$2",
        );
      }

      try {
        if (shouldConfirm) {
          await paymobConfirm.mutateAsync({ orderId: id, params });
          if (!cancelled) toast.success(t("orders:paymentConfirmed"));
        } else {
          toast.message(t("orders:confirmingPayment"));
          await refetch();
        }
      } catch (err) {
        if (!cancelled) {
          // Webhook/inquiry may still mark paid shortly after redirect.
          toast.message(isTabbyReturn ? t("orders:confirmingPayment") : err.message || t("orders:confirmingPayment"));
          await refetch();
          setTimeout(() => {
            if (!cancelled) refetch();
          }, 2500);
        }
      } finally {
        if (!cancelled) setSearchParams({}, { replace: true });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isLoading || (isFetching && !order)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    const notFound = error.status === 404;
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6">
        <h1 className="font-display text-2xl text-navy">
          {notFound ? t("orders:notFound") : t("orders:loadErrorTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {notFound ? null : t("orders:loadErrorDesc")}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          {!notFound && (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t("common:retry", "Retry")}
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to="/orders">{t("orders:backToOrders")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6">
        <h1 className="font-display text-2xl text-navy">
          {t("orders:notFound")}
        </h1>
        <Button asChild className="mt-4" variant="outline" size="sm">
          <Link to="/orders">{t("orders:backToOrders")}</Link>
        </Button>
      </div>
    );
  }

  const shipTo = order.ship_to || {};
  const estimated = isEstimatedPricing(order);
  const displayTotal = orderDisplayTotal(order);
  const collection = order.payment_collection;
  const awaitingManual =
    order.payment_method === "manual" && order.payment_status === "pending";
  const canChangePayment =
    order.status === "placed" &&
    ["pending", "cod_pending"].includes(order.payment_status);
  const awaitingOnline =
    order.payment_method === "online" && order.payment_status === "pending";
  const tabbyEnabled = storeSettings?.tabby_configured === true;
  const paymobEnabled = storeSettings?.paymob_configured === true;
  const onlineEnabled = storeSettings?.online_checkout_enabled === true;
  const codEnabled = storeSettings?.cod_enabled === true;
  const bankEnabled = storeSettings?.bank_transfer_enabled !== false;
  const paymentBusy = paymobCheckout.isPending || changePayment.isPending;
  const verifiedManual =
    order.payment_method === "manual" && order.payment_status === "paid";

  const startOnlinePayment = async (provider) => {
    const lang = getContentLang(i18n.language);
    try {
      const result = provider && provider !== order.payment_provider
        ? await changePayment.mutateAsync({
            orderId: order.id,
            paymentMethod: "online",
            paymentProvider: provider,
            lang,
          })
        : await paymobCheckout.mutateAsync({
            orderId: order.id,
            paymentProvider: provider || order.payment_provider,
            lang,
          });
      const checkoutUrl = result?.checkout_url;
      if (checkoutUrl) window.location.assign(checkoutUrl);
    } catch (err) {
      const tabbyReason = provider === "tabby" ? tabbyReasonFromError(err) : null;
      toast.error(
        tabbyReason
          ? tabbyUnavailableMessage(tabbyReason, t)
          : err.message || "Could not start online payment",
      );
    }
  };

  const switchPaymentMethod = async (paymentMethod) => {
    try {
      await changePayment.mutateAsync({ orderId: order.id, paymentMethod });
      toast.success(
        paymentMethod === "cod"
          ? "Switched to cash on delivery"
          : "Switched to bank transfer. The store will verify payment.",
      );
    } catch (err) {
      toast.error(err.message || "Could not change payment method");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2 h-8">
        <Link to="/orders">
          <ChevronLeft className="h-4 w-4" />
          {t("orders:allOrders")}
        </Link>
      </Button>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gold">
            {t("orders:orderEyebrow")}
          </p>
          <h1 className="font-display text-2xl text-navy sm:text-3xl">
            {order.order_number}
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            {formatDateSafe(order.placed_at, "dd MMM yyyy · hh:mm a")}
          </p>
          {order.invoice_number && (
            <div className="mt-2">
              <InvoiceNumber number={order.invoice_number} compact />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={ORDER_STATUS_VARIANT[order.status] || "muted"}>
            {getOrderStatusLabel(order.status, t)}
          </Badge>
          <OrderRequestBadges
            returns={order.returns}
            orderStatus={order.status}
          />
          {order.is_gift && (
            <Badge variant="gold">{t("common:giftBadge")}</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              openOrderInvoice(order, {
                store: storeSettings,
                autoPrint: false,
                lang: i18n.language,
              })
            }
          >
            <Printer className="h-4 w-4" />
            {t("orders:viewDownloadInvoice")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <section className="rounded-lg border border-line bg-white p-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-navy">
              {t("orders:items")}
            </h2>
            <div className="mt-2">
              <OrderItemsList items={order.order_items} detailed />
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-3">
            <OrderTimeline
              history={order.order_status_history}
              currentStatus={order.status}
            />
          </section>

          <ReturnRequest order={order} />
        </div>

        <div className="space-y-3">
          <section className="rounded-lg border border-line bg-white p-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-navy">
              {t("orders:deliveryUae")}
            </h2>
            <div className="mt-2">
              <AddressDisplay address={shipTo} />
            </div>
          </section>

          {order.is_gift && (
            <section className="rounded-lg border border-line bg-white p-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-navy">
                {t("orders:giftNote")}
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
                {order.gift_note?.trim() || t("common:noGiftMessage")}
              </p>
            </section>
          )}

          <section className="rounded-lg border border-line bg-white p-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-navy">
              {t("orders:payment")}
            </h2>
            <dl className="mt-2 space-y-1 text-sm">
              {estimated && (
                <div className="rounded-md border border-gold/30 bg-gold/10 px-2 py-1 text-xs text-navy">
                  <p className="font-semibold">
                    {t("orders:estimatedUntilHandover")}
                  </p>
                  <p>{t("orders:codPriceMayVary")}</p>
                </div>
              )}
              {canChangePayment && (
                <div className="rounded-md border border-gold/30 bg-gold/10 px-2 py-2 text-xs text-navy">
                  <p className="font-semibold">
                    {awaitingOnline
                      ? "Online payment is not complete. Retry or choose another method."
                      : "You can still change how you pay for this order."}
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    {onlineEnabled && paymobEnabled && (
                      <Button
                        size="sm"
                        disabled={paymentBusy}
                        onClick={() => startOnlinePayment("paymob")}
                      >
                        {paymentBusy ? "Starting payment…" : "Pay with card (Paymob)"}
                      </Button>
                    )}
                    {onlineEnabled && tabbyEnabled && (
                      <Button
                        size="sm"
                        variant={paymobEnabled ? "outline" : "default"}
                        disabled={paymentBusy}
                        onClick={() => startOnlinePayment("tabby")}
                      >
                        {paymentBusy ? t("orders:startingPayment") : t("orders:payWithTabby")}
                      </Button>
                    )}
                    {codEnabled && order.payment_method !== "cod" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={paymentBusy}
                        onClick={() => switchPaymentMethod("cod")}
                      >
                        Switch to cash on delivery
                      </Button>
                    )}
                    {bankEnabled && order.payment_method !== "manual" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={paymentBusy}
                        onClick={() => switchPaymentMethod("manual")}
                      >
                        Switch to bank transfer
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {awaitingManual && (
                <div className="rounded-md border border-gold/30 bg-gold/10 px-2 py-1 text-xs text-navy">
                  {t("orders:awaitingVerification")}
                </div>
              )}
              {verifiedManual && (
                <div className="rounded-md border border-[#2f7d4f]/30 bg-[#2f7d4f]/10 px-2 py-1 text-xs text-navy">
                  {t("orders:paymentVerified")}
                </div>
              )}

              <div className="flex justify-between">
                <dt className="text-muted">
                  {t("orders:merchandiseSubtotal")}
                </dt>
                <dd>{formatINR(order.subtotal)}</dd>
              </div>
              {order.making_charge_total > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">
                    {t("orders:makingChargeTotal")}
                  </dt>
                  <dd>{formatINR(order.making_charge_total)}</dd>
                </div>
              )}
              {order.coupon_code && (
                <div className="flex justify-between">
                  <dt className="text-muted">
                    {t("orders:coupon")} {order.coupon_code}
                  </dt>
                  <dd className="text-[#2f7d4f]">
                    −{formatINR(order.discount_amount || 0)}
                  </dd>
                </div>
              )}
              {!order.coupon_code && Number(order.discount_amount) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">{t("orders:discount")}</dt>
                  <dd className="text-[#2f7d4f]">
                    −{formatINR(order.discount_amount)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">{t("orders:shipping")}</dt>
                <dd>
                  {order.shipping_fee > 0
                    ? formatINR(order.shipping_fee)
                    : t("orders:freeShipping")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t("orders:vat")}</dt>
                <dd>{formatINR(order.tax_amount)}</dd>
              </div>
              {order.tax_breakdown?.zero_rated_total > 0 && (
                <div className="flex justify-between text-xs">
                  <dt className="text-muted">Zero-rated (24KT)</dt>
                  <dd>{formatINR(order.tax_breakdown.zero_rated_total)}</dd>
                </div>
              )}
              {order.tax_breakdown?.standard_rated_total > 0 && (
                <div className="flex justify-between text-xs">
                  <dt className="text-muted">Standard-rated</dt>
                  <dd>{formatINR(order.tax_breakdown.standard_rated_total)}</dd>
                </div>
              )}
              {order.tax_breakdown?.exempt_total > 0 && (
                <div className="flex justify-between text-xs">
                  <dt className="text-muted">Exempt</dt>
                  <dd>{formatINR(order.tax_breakdown.exempt_total)}</dd>
                </div>
              )}
              {order.wallet_applied > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">{t("orders:walletApplied")}</dt>
                  <dd className="text-[#2f7d4f]">
                    −{formatINR(order.wallet_applied)}
                  </dd>
                </div>
              )}

              {estimated ? (
                <div className="flex justify-between border-t border-line pt-2 font-semibold text-navy">
                  <dt>{t("orders:estimatedTotal")}</dt>
                  <dd className="text-gold">{formatINR(displayTotal)}</dd>
                </div>
              ) : (
                <div className="flex justify-between border-t border-line pt-2 font-semibold text-navy">
                  <dt>
                    {order.final_total != null
                      ? t("orders:finalTotal")
                      : t("orders:total")}
                  </dt>
                  <dd className="text-gold">{formatINR(displayTotal)}</dd>
                </div>
              )}

              {order.amount_due != null && order.payment_status !== "paid" && (
                <div className="flex justify-between font-semibold text-navy">
                  <dt>{t("orders:amountDue")}</dt>
                  <dd>{formatINR(order.amount_due)}</dd>
                </div>
              )}
              {collection?.amount != null &&
                order.payment_status === "paid" && (
                  <div className="flex justify-between">
                    <dt className="text-muted">
                      {t("orders:amountCollected")}
                    </dt>
                    <dd>{formatINR(collection.amount)}</dd>
                  </div>
                )}

              <div className="space-y-1 border-t border-line pt-2 text-[11px] text-muted">
                <p>{getPaymentMethodLabel(order.payment_method, t)}</p>
                {order.payment_mode && (
                  <p>{getPaymentModeLabel(order.payment_mode, t)}</p>
                )}
                <p>{getPaymentStatusLabel(order.payment_status, t)}</p>
                <p>
                  {order.pricing_mode === "cod_delivery"
                    ? t("orders:estimatedUntilHandover")
                    : t("orders:finalizedAtVerification")}
                </p>
                {order.paid_at && (
                  <p>
                    {t("orders:paidAt")}:{" "}
                    {formatDateSafe(order.paid_at, "dd MMM yyyy · HH:mm")}
                  </p>
                )}
                {order.finalized_at && (
                  <p>
                    {t("orders:finalizedAt")}:{" "}
                    {formatDateSafe(order.finalized_at, "dd MMM yyyy · HH:mm")}
                  </p>
                )}
                {collection?.transaction_ref_masked && (
                  <p>
                    {t("orders:transactionReference")}:{" "}
                    {collection.transaction_ref_masked}
                  </p>
                )}
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

export function OrderDetailPage() {
  return (
    <RequireCustomer>
      <OrderDetailContent />
    </RequireCustomer>
  );
}
