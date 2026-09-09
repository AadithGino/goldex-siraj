import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Banknote, CreditCard, Wallet, Info, ShieldCheck } from 'lucide-react'
import { formatAED } from '@/lib/pricing'
import { Button } from '@/components/ui/button'
import { GiftOptions } from '@/components/checkout/GiftOptions'
import { useWalletBalance } from '@/hooks/useWallet'
import { cn } from '@/lib/utils'
import { useStoreSettings } from '@/hooks/useStoreSettings'
import { PolicyLinks } from '@/components/legal/PolicyLinks'

export function PaymentConfirm({
  total,
  onConfirm,
  isPlacing,
  isGift,
  giftNote,
  onIsGiftChange,
  onGiftNoteChange,
}) {
  const { t } = useTranslation(['checkout', 'common'])
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
        label: 'Tabby',
        icon: ShieldCheck,
        note: 'Split your purchase with Tabby. Total is locked when you place the order.',
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
  }, [bankEnabled, codEnabled, onlineEnabled, paymobEnabled, tabbyEnabled, t])
  const availableMethods = methods
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

  const codMin = Number(settings?.cod_min_order_amount ?? 0)
  const codMax =
    settings?.cod_max_order_amount == null ? null : Number(settings.cod_max_order_amount)
  const codBelowMin = method === 'cod' && Number(total || 0) < codMin
  const codAboveMax = method === 'cod' && codMax != null && Number(total || 0) > codMax

  const handleConfirm = () => {
    if (allDisabled) return
    onConfirm({
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
        {availableMethods.map((m) => {
          const Icon = m.icon
          const active = method === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                active ? 'border-navy bg-ivory-3 ring-1 ring-navy/10' : 'border-line bg-white hover:border-navy/30'
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-navy">
                <Icon className="h-4 w-4 shrink-0" /> {m.label}
              </span>
              <span className="mt-1 block text-[11px] text-muted">{m.note}</span>
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

      {(method === 'online_tabby' || method === 'online_paymob') && (
        <div className="rounded-lg border border-line bg-white p-3">
          <p className="text-xs leading-relaxed text-muted">
            {method === 'online_tabby'
              ? 'You will be redirected to Tabby checkout. Payment confirmation is handled automatically once Tabby verifies the transaction.'
              : 'You will be redirected to Paymob secure checkout to pay by card. Payment confirmation is handled automatically once Paymob verifies the transaction.'}
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
            <span>{method === 'cod' ? t('checkout:estimatedTotal') : 'Order total (locked at placement)'}</span>
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
            : method === 'online_tabby'
              ? 'This Tabby total is locked when you place the order. You will complete payment on Tabby before the order is confirmed.'
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
          disabled={isPlacing || allDisabled || codBelowMin || codAboveMax}
        >
          {allDisabled
            ? 'Payment unavailable'
            : isPlacing
              ? t('common:placingOrder')
              : method === 'cod'
                ? t('checkout:placeOrderCod', { amount: formatAED(due) })
                : method === 'online_tabby'
                  ? `Pay ${formatAED(due)} with Tabby`
                  : method === 'online_paymob'
                  ? `Pay ${formatAED(due)} with card`
                  : `Place bank-transfer order · ${formatAED(due)}`}
        </Button>
      </div>
    </div>
  )
}
