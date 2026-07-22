import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShoppingBag } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { useCartTotals } from '@/hooks/useCartTotals'
import { CartItem } from '@/components/cart/CartItem'
import { CheckoutFlowLayout } from '@/components/checkout/CheckoutFlowLayout'
import { CheckoutOrderSidebar } from '@/components/checkout/CheckoutOrderSidebar'
import { Button } from '@/components/ui/button'
import { RequireCustomer } from '@/components/auth/RequireCustomer'
import { PolicyLinks } from '@/components/legal/PolicyLinks'

function CartPageContent() {
  const { t } = useTranslation(['checkout', 'common'])
  const navigate = useNavigate()
  const { items, isLoading, updateQty, updateVariant, remove, isUpdating } = useCart()
  const totals = useCartTotals(items)

  if (!isLoading && !items.length) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
        <ShoppingBag className="mx-auto h-10 w-10 text-gold" />
        <h1 className="mt-4 font-display text-3xl text-navy">{t('checkout:emptyBagTitle')}</h1>
        <p className="mt-2 text-sm text-muted">{t('checkout:emptyBagDesc')}</p>
        <Button type="button" className="mt-6" onClick={() => navigate('/search')}>
          {t('common:shopNow')}
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('checkout:bagEyebrow')}</p>
        <h1 className="font-display text-[clamp(28px,3.3vw,46px)] text-navy">{t('checkout:bagTitle')}</h1>
      </div>

      <CheckoutFlowLayout
        main={
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted">{t('common:loadingBag')}</p>
            ) : (
              items.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onUpdateQty={updateQty}
                  onUpdateVariant={updateVariant}
                  onRemove={remove}
                  isUpdating={isUpdating}
                />
              ))
            )}
          </div>
        }
        sidebar={
          <CheckoutOrderSidebar
            linePrices={totals.linePrices}
            totals={totals}
            isLoading={totals.isLoading || isLoading}
            showCheckout={items.length > 0}
            showLineItems={false}
          />
        }
      />

      <div className="mt-8 border-t border-line pt-6 text-center">
        <p className="text-xs text-muted">{t('checkout:policiesNotice')}</p>
        <PolicyLinks className="mt-3" />
      </div>
    </div>
  )
}

export function CartPage() {
  return (
    <RequireCustomer>
      <CartPageContent />
    </RequireCustomer>
  )
}
