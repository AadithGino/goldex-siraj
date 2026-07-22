import { useTranslation } from 'react-i18next'
import { RequireCustomer } from '@/components/auth/RequireCustomer'
import { OrderList } from '@/components/account/OrderList'
import { useOrders } from '@/hooks/useOrders'

function OrdersPageContent() {
  const { t } = useTranslation(['orders', 'common'])
  const { data: orders, isLoading, isError, refetch } = useOrders()

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('common:accountLabel')}</p>
        <h1 className="font-display text-[clamp(28px,3.3vw,46px)] text-navy">{t('orders:title')}</h1>
      </div>
      <OrderList
        orders={orders}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
      />
    </div>
  )
}

export function OrdersPage() {
  return (
    <RequireCustomer>
      <OrdersPageContent />
    </RequireCustomer>
  )
}
