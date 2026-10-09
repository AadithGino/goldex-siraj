import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Banknote, CreditCard, Wallet, Info, ShieldCheck } from 'lucide-react'
import { formatAED } from '@/lib/pricing'
import { Button } from '@/components/ui/button'
import { GiftOptions } from '@/components/checkout/GiftOptions'
import { TabbyCardSnippet } from '@/components/payments/TabbySnippet'
import { useWalletBalance } from '@/hooks/useWallet'
import { useTabbyEligibility } from '@/hooks/useTabby'
import { cn } from '@/lib/utils'
import { getContentLang } from '@/lib/contentLocale'
import { tabbyUnavailableMessage } from '@/lib/tabby'
import { TABBY_LOGO_SRC } from '@/lib/tabbyBrand'
import { useStoreSettings } from '@/hooks/useStoreSettings'
import { PolicyLinks } from '@/components/legal/PolicyLinks'

export function PaymentConfirm({
  total,
  addressId,
  tabbyRejectionReason = null,
  onConfirm,
  isPlacing,
  isGift,
  giftNote,
  onIsGiftChange,
  onGiftNoteChange,
}) {
  const { t, i18n } = useTranslation(['checkout', 'common'])
  const lang = getContentLang(i18n.language)
  const { data: walletBalance = 0 } = useWalletBalance()
  const { data: settings } = useStoreSettings()
  const [method, setMethod] = useState('cod')
  const [useWallet, setUseWallet] = useState(false)

  const walletApplied = useMemo(() => {
    if (!useWallet) return 0
    return Math.min(Number(walletBalance) || 0, Number(total) || 0)
  }, [useWallet, walletBalance, total])

  const due = Math.max((Number(total) || 0) - walletApplied, 0)

  const codEnabled = settings?.cod_enabled === true
  const bankEnabled = settings?.bank_transfer_enabled !== false
  const onlineEnabled = settings?.online_checkout_enabled === true
  const paymobEnabled = settings?.paymob_configured === true
  const tabbyEnabled = settings?.tabby_configured === true

  const eligibility = useTabbyEligibility({
    amount: due,
    addressId,
    lang,
    enabled: onlineEnabled && tabbyEnabled,
  })
  const tabbyUnavailableReason = tabbyRejectionReason
    || (eligibility.data && eligibility.data.available === false ? eligibility.data.reason || 'not_available' : null)
  const tabbyChecking = onlineEnabled && tabbyEnabled && eligibility.isLoading

  const methods = useMemo(() => {
    const rows = [
      {
        id: 'cod',
        label: t('checkout:cod'),
        icon: Banknote,
        note: t('checkout:codNote'),
        enabled: codEnabled,
      },
      {
        id: 'online_tabby',
        label: t('checkout:tabby.methodName'),
        logo: TABBY_LOGO_SRC,
        logoAlt: t('checkout:tabby.logoAlt'),
        note: tabbyChecking
          ? t('checkout:tabby.checking')
          : tabbyUnavailableReason
            ? tabbyUnavailableMessage(tabbyUnavailableReason, t)
            : null,
        unavailable: Boolean(tabbyUnavailableReason),
        enabled: onlineEnabled && tabbyEnabled,
      },
      {
        id: 'online_paymob',
        label: 'Card (Paymob)',
        icon: ShieldCheck,
        note: 'Pay securely by card on Paymob. Total is locked when you place the order.',
        enabled: onlineEnabled && paymobEnabled,
      },
      {
        id: 'manual',
        label: 'Bank transfer (arranged by call)',
        icon: CreditCard,
        note: 'Place the order now at the locked total below. The store will contact you; an admin marks it paid only after verifying the transfer.',
        enabled: bankEnabled,
      },
    ]
    return rows.filter((row) => row.enabled)
  }, [bankEnabled, codEnabled, onlineEnabled, paymobEnabled, tabbyEnabled, tabbyChecking, tabbyUnavailableReason, t])
  const availableMethods = useMemo(() => methods.filter((row) => !row.unavailable), [methods])
  const allDisabled = availableMethods.length === 0

  useEffect(() => {
    if (allDisabled) return
    if (availableMethods.length === 1) {
      setMethod(availableMethods[0].id)
      return
    }
    if (!availableMethods.some((m) => m.id === method)) {
      setMethod(availableMethods[0]?.id || 'cod')
    }
  }, [availableMethods, method, allDisabled])

  const isTabby = method === 'online_tabby'

  const codMin = Number(settings?.cod_min_order_amount ?? 0)
  const codMax =
    settings?.cod_max_order_amount == null ? null : Number(settings.cod_max_order_amount)
  const codBelowMin = method === 'cod' && Number(total || 0) < codMin
  const codAboveMax = method === 'cod' && codMax != null && Number(total || 0) > codMax

  const handleConfirm = () => {
    if (allDisabled || (isTabby && tabbyUnavailableReason)) return
    onConfirm({
      lang,
      paymentMethod: method.startsWith('online_') ? 'online' : method,
      paymentProvider: method === 'online_tabby' ? 'tabby' : method === 'online_paymob' ? 'paymob' : null,
      paymentMode: method === 'cod' ? 'cash' : method.startsWith('online_') ? 'card' : 'bank_transfer',
      walletApply: walletApplied,
      isGift,
      giftNote: isGift ? giftNote.trim() : '',
    })
  }

  return (
    <div className="space-y-3">
      <GiftOptions
        isGift={isGift}
        giftNote={giftNote}
        onIsGiftChange={onIsGiftChange}
        onGiftNoteChange={onGiftNoteChange}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        {methods.map((m) => {
          const Icon = m.icon
          const active = method === m.id && !m.unavailable
          return (
            <button
              key={m.id}
              type="button"
              disabled={m.unavailable}
              aria-disabled={m.unavailable}
              onClick={() => !m.unavailable && setMethod(m.id)}
              className={cn(
                'rounded-lg border p-3 text-start transition-colors',
                m.unavailable
                  ? 'cursor-not-allowed border-line bg-white opacity-70'
                  : active ? 'border-navy bg-ivory-3 ring-1 ring-navy/10' : 'border-line bg-white hover:border-navy/30'
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-navy">
                {m.logo
                  ? <img src={m.logo} alt={m.logoAlt} className="h-5 w-auto shrink-0" />
                  : <Icon className="h-4 w-4 shrink-0" />}
                {m.label}
                {m.unavailable && (
                  <span className="ms-auto text-[10px] font-medium uppercase text-muted">{t('checkout:tabby.unavailable')}</span>
                )}
              </span>
              {m.note && (
                <span className={cn('mt-1 block text-[11px]', m.unavailable ? 'text-destructive' : 'text-muted')}>{m.note}</span>
              )}
            </button>
          )
        })}
      </div>

      {allDisabled && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          No payment methods are currently available. Please contact the store.
        </p>
      )}

      {!allDisabled && method === 'cod' && (codBelowMin || codAboveMax) && (
        <p className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-navy">
          {codBelowMin
            ? `COD is available for orders from ${formatAED(codMin)}.`
            : `COD is available up to ${formatAED(codMax)} for this store.`}
        </p>
      )}

      {method === 'manual' && (
        <div className="rounded-lg border border-line bg-white p-3">
          <p className="text-xs leading-relaxed text-muted">No payment is collected on this website. After the store confirms your order by phone, transfer to the provided bank account. Your order is marked paid only after an owner or manager verifies the payment.</p>
        </div>
      )}

      {isTabby && (
        <div className="space-y-2 rounded-lg border border-line bg-white p-3">
          <TabbyCardSnippet price={due} />
          <p className="text-xs leading-relaxed text-muted">{t('checkout:tabby.redirectNote')}</p>
        </div>
      )}

      {method === 'online_paymob' && (
        <div className="rounded-lg border border-line bg-white p-3">
          <p className="text-xs leading-relaxed text-muted">
            You will be redirected to Paymob secure checkout to pay by card. Payment confirmation is handled automatically once Paymob verifies the transaction.
          </p>
        </div>
      )}

      {walletBalance > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2.5 text-sm">
          <span className="flex items-center gap-2 text-navy">
            <Wallet className="h-4 w-4 text-gold" />
            {t('checkout:walletLabel')} <strong>{formatAED(walletBalance)}</strong>
          </span>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={useWallet}
              onChange={(e) => setUseWallet(e.target.checked)}
              className="h-4 w-4 accent-[var(--navy)]"
            />
            {t('checkout:useWallet')}
          </label>
        </div>
      )}

      <div className="rounded-lg border border-line bg-white p-3">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted">
            <span>{method === 'cod' ? t('checkout:estimatedTotal') : t('checkout:lockedOrderTotal')}</span>
            <span className="text-navy">{formatAED(total)}</span>
          </div>
          {walletApplied > 0 && (
            <div className="flex justify-between text-gold">
              <span>{t('checkout:walletDeduction')}</span>
              <span>− {formatAED(walletApplied)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-2 font-semibold text-navy">
            <span>
              {method === 'cod'
                ? t('checkout:payOnDelivery')
                : isTabby
                  ? t('checkout:tabby.totalDue')
                  : method.startsWith('online_')
                    ? 'Card payment due'
                    : 'Bank transfer due (locked)'}
            </span>
            <span>{formatAED(due)}</span>
          </div>
        </div>

        <p className="mt-3 flex gap-2 rounded-lg bg-ivory-3 p-2.5 text-[11px] leading-relaxed text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy" />
          {method === 'cod'
            ? 'This COD total is an estimate. The final amount is recalculated using the live gold rate only when the package is physically handed to you.'
            : isTabby
              ? t('checkout:tabby.infoNote')
              : method === 'online_paymob'
                ? 'This card total is locked when you place the order. You will complete payment on Paymob before the order is confirmed.'
              : 'This bank/card total is locked when you place the order. It is not live-repriced when payment is verified.'}
        </p>

        <p className="mt-3 text-[11px] leading-relaxed text-muted">{t('checkout:policiesAgreement')}</p>
        <PolicyLinks
          className="mt-2"
          linkClassName="text-[11px] text-muted hover:text-navy"
        />

        <Button
          className="mt-3 w-full"
          size="sm"
          onClick={handleConfirm}
          disabled={isPlacing || allDisabled || codBelowMin || codAboveMax || tabbyChecking || (isTabby && Boolean(tabbyUnavailableReason))}
        >
          {allDisabled
            ? 'Payment unavailable'
            : isPlacing
              ? t('common:placingOrder')
              : method === 'cod'
                ? t('checkout:placeOrderCod', { amount: formatAED(due) })
                : isTabby
                  ? t('checkout:tabby.payButton', { amount: formatAED(due) })
                  : method === 'online_paymob'
                  ? `Pay ${formatAED(due)} with card`
                  : `Place bank-transfer order · ${formatAED(due)}`}
        </Button>
      </div>
    </div>
  )
}
