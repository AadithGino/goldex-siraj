import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { RequireCustomer } from '@/components/auth/RequireCustomer'
import { AddressSelect } from '@/components/checkout/AddressSelect'
import { CheckoutFlowLayout } from '@/components/checkout/CheckoutFlowLayout'
import { CheckoutOrderSidebar } from '@/components/checkout/CheckoutOrderSidebar'
import { OrderReview } from '@/components/checkout/OrderReview'
import { PaymentConfirm } from '@/components/checkout/PaymentConfirm'
import { useCart } from '@/hooks/useCart'
import { useCartTotals } from '@/hooks/useCartTotals'
import { useAddresses } from '@/hooks/useAddresses'
import { usePlaceOrder } from '@/hooks/useOrders'
import { Button } from '@/components/ui/button'
import { formatAED } from '@/lib/pricing'
import { cn } from '@/lib/utils'

function CheckoutPageContent() {
  const { t } = useTranslation(['checkout', 'common', 'errors'])
  const navigate = useNavigate()
  const { items, isLoading: cartLoading } = useCart()
  const { addresses, create, isSaving, isLoading: addressesLoading } = useAddresses()
  const { mutateAsync: placeOrder, isPending: isPlacing } = usePlaceOrder()

  const steps = useMemo(
    () => [
      t('checkout:step.address'),
      t('checkout:step.review'),
      t('checkout:step.confirm'),
    ],
    [t]
  )

  const [step, setStep] = useState(0)
  const [selectedAddressId, setSelectedAddressId] = useState(null)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [isGift, setIsGift] = useState(false)
  const [giftNote, setGiftNote] = useState('')

  const idempotencyKeyRef = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
  const expectedTotalRef = useRef(null)

  const totals = useCartTotals(items, appliedCoupon?.code || null)

  useEffect(() => {
    if (step === 2 && totals.total > 0) {
      expectedTotalRef.current = totals.total
    }
  }, [step, totals.total])

  const activeAddressId =
    selectedAddressId || addresses.find((a) => a.is_default)?.id || addresses[0]?.id

  const handleSaveAddress = async (form) => {
    try {
      const saved = await create(form)
      setSelectedAddressId(saved.id)
      setShowAddressForm(false)
      toast.success(t('common:addressSaved'))
    } catch (err) {
      toast.error(err.message || t('errors:checkout.saveAddressFailed'))
    }
  }

  const handlePlaceOrder = async ({
    paymentMethod,
    paymentMode,
    walletApply,
    isGift: giftOrder,
    giftNote: note,
  } = {}) => {
    if (!activeAddressId) {
      toast.error(t('errors:checkout.selectAddress'))
      return
    }
    try {
      const result = await placeOrder({
        addressId: activeAddressId,
        couponCode: appliedCoupon?.code,
        paymentMethod: paymentMethod || 'cod',
        paymentMode: paymentMode || (paymentMethod === 'manual' ? 'bank_transfer' : 'cash'),
        walletApply: walletApply || 0,
        isGift: !!giftOrder,
        giftNote: giftOrder ? note?.trim() : null,
        idempotencyKey: idempotencyKeyRef.current,
      })

      const expected = expectedTotalRef.current
      if (
        expected != null &&
        result.total != null &&
        Math.abs(Number(result.total) - expected) > 0.02
      ) {
        toast.warning(t('common:priceUpdatedAtCheckout', { amount: formatAED(result.total) }), {
          duration: 6000,
        })
      }

      toast.success((paymentMethod || 'cod') === 'manual' ? `Order ${result.order_number} placed. The store will contact you with bank-transfer instructions.` : t('common:orderPlaced', { number: result.order_number }))
      navigate(`/orders/${result.order_id}`, { replace: true })
    } catch (err) {
      toast.error(err.message || t('errors:checkout.placeOrderFailed'))
    }
  }

  if (!cartLoading && !items.length) {
    navigate('/cart', { replace: true })
    return null
  }

  const sidebar = (
    <CheckoutOrderSidebar
      linePrices={totals.linePrices}
      totals={totals}
      isLoading={totals.isLoading || cartLoading}
      showCheckout={false}
    />
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('checkout:checkoutEyebrow')}</p>
        <h1 className="font-display text-[clamp(28px,3.3vw,46px)] text-navy">{t('checkout:checkoutTitle')}</h1>
      </div>

      <div className="mb-8 flex gap-2">
        {steps.map((label, index) => (
          <div
            key={label}
            className={cn(
              'flex flex-1 items-center justify-center rounded-full border py-2 text-xs font-semibold sm:text-sm',
              index === step
                ? 'border-navy bg-navy text-gold-3'
                : index < step
                  ? 'border-gold/30 bg-ivory-3 text-gold'
                  : 'border-gold/20 text-muted'
            )}
          >
            {index + 1}. {label}
          </div>
        ))}
      </div>

      <CheckoutFlowLayout
        sidebar={sidebar}
        main={
          <>
            {step === 0 && (
              <div>
                <h2 className="mb-4 font-display text-xl text-navy sm:text-2xl">{t('checkout:deliveryAddress')}</h2>
                {addressesLoading ? (
                  <p className="text-sm text-muted">{t('common:loadingAddresses')}</p>
                ) : (
                  <AddressSelect
                    addresses={addresses}
                    selectedId={activeAddressId}
                    onSelect={setSelectedAddressId}
                    showForm={showAddressForm}
                    onToggleForm={() => setShowAddressForm((v) => !v)}
                    onSaveAddress={handleSaveAddress}
                    isSaving={isSaving}
                  />
                )}
                <div className="mt-6 flex justify-end">
                  <Button disabled={!activeAddressId} onClick={() => setStep(1)}>
                    {t('common:continue')}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="mb-4 font-display text-xl text-navy sm:text-2xl">{t('checkout:reviewOrder')}</h2>
                <OrderReview
                  totals={totals}
                  appliedCoupon={appliedCoupon}
                  onApplyCoupon={setAppliedCoupon}
                  onRemoveCoupon={() => setAppliedCoupon(null)}
                />
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <Button variant="outline" onClick={() => setStep(0)}>
                    <ChevronLeft className="h-4 w-4" />
                    {t('common:back')}
                  </Button>
                  <Button
                    disabled={totals.isLoading || !!totals.error || !(totals.total > 0)}
                    onClick={() => setStep(2)}
                  >
                    {t('common:continue')}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                {totals.error && (
                  <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <p>Could not load an authoritative quote. Order placement is blocked until the quote succeeds.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => totals.refetch?.()}
                    >
                      Retry quote
                    </Button>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="mb-4 font-display text-xl text-navy sm:text-2xl">{t('checkout:payment')}</h2>
                {totals.error || totals.isLoading || !(totals.total > 0) ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                    {totals.isLoading
                      ? 'Loading locked checkout total…'
                      : 'Quote failed. AED 0.00 is not a valid total. Retry before placing the order.'}
                    {!totals.isLoading && (
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => totals.refetch?.()}>
                        Retry quote
                      </Button>
                    )}
                  </div>
                ) : (
                  <PaymentConfirm
                    total={totals.total}
                    onConfirm={handlePlaceOrder}
                    isPlacing={isPlacing}
                    isGift={isGift}
                    giftNote={giftNote}
                    onIsGiftChange={setIsGift}
                    onGiftNoteChange={setGiftNote}
                  />
                )}
                <div className="mt-4">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ChevronLeft className="h-4 w-4" />
                    {t('common:backToReview')}
                  </Button>
                </div>
              </div>
            )}
          </>
        }
      />
    </div>
  )
}

export function CheckoutPage() {
  return (
    <RequireCustomer>
      <CheckoutPageContent />
    </RequireCustomer>
  )
}
