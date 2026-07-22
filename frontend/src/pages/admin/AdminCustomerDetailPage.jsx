import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { OrderStatusBadge } from '@/components/admin/shared/OrderStatusBadge'
import { WalletHistory } from '@/components/account/WalletHistory'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAdminCustomer, useAdminCustomerMutations } from '@/hooks/useAdminCustomers'
import { useAdminCustomerWallet } from '@/hooks/useWallet'
import { useStoreSettings } from '@/hooks/useStoreSettings'
import { formatAED } from '@/lib/pricing'
import { getNextDueInstallment, formatSchemeDate } from '@/lib/schemeUtils'
import { InvoiceNumber } from '@/components/shared/InvoiceNumber'

const ENROLLMENT_STATUS = {
  active: { label: 'Active', variant: 'success' },
  completed: { label: 'Completed', variant: 'gold' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
}

export function AdminCustomerDetailPage() {
  const { id } = useParams()
  const { data: customer, isLoading } = useAdminCustomer(id)
  const toggleActive = useAdminCustomerMutations()
  const { data: settings } = useStoreSettings()
  const schemeEnabled = settings?.scheme_enabled
  const { data: walletTxs, isLoading: walletLoading } = useAdminCustomerWallet(id)
  const walletBalance = walletTxs?.reduce((sum, t) => sum + Number(t.amount), 0) ?? 0

  const handleToggle = async () => {
    if (!customer) return
    try {
      await toggleActive.mutateAsync({ id: customer.id, is_active: !customer.is_active })
      toast.success(customer.is_active ? 'Customer deactivated' : 'Customer activated')
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 w-full rounded-[28px]" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center">
        <p className="text-muted">Customer not found.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/admin/customers">Back to customers</Link>
        </Button>
      </div>
    )
  }

  const orderCount = customer.orders?.length || 0
  const enrollmentCount = customer.enrollments?.length || 0

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
        <Link to="/admin/customers">
          <ChevronLeft className="h-4 w-4" />
          Customers
        </Link>
      </Button>

      <AdminPageHeader
        title={customer.full_name || 'Unnamed customer'}
        description={`${customer.phone || 'No phone'}${customer.email ? ` · ${customer.email}` : ''}`}
        action={
          <Button variant="outline" onClick={handleToggle}>
            {customer.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant={customer.is_active ? 'success' : 'destructive'}>
          {customer.is_active ? 'Active account' : 'Inactive account'}
        </Badge>
        <Badge variant="outline">
          Joined {format(new Date(customer.created_at), 'dd MMM yyyy')}
        </Badge>
        <Badge variant="outline">{orderCount} order{orderCount === 1 ? '' : 's'}</Badge>
        {schemeEnabled && (
          <Badge variant="outline">
            {enrollmentCount} scheme enrollment{enrollmentCount === 1 ? '' : 's'}
          </Badge>
        )}
        <Badge variant="outline" className="flex items-center gap-1">
          <Wallet className="h-3 w-3" />
          Wallet: {formatAED(walletBalance)}
        </Badge>
      </div>

      <Tabs defaultValue="orders">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="orders">
            Orders {orderCount > 0 && `(${orderCount})`}
          </TabsTrigger>
          {schemeEnabled && (
            <TabsTrigger value="enrollments">
              Scheme enrollments {enrollmentCount > 0 && `(${enrollmentCount})`}
            </TabsTrigger>
          )}
          <TabsTrigger value="wallet" className="gap-1.5">
            <Wallet className="h-3.5 w-3.5" />
            Wallet
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          {!orderCount ? (
            <p className="rounded-[28px] border border-gold/20 bg-ivory-2 p-8 text-center text-sm text-muted">
              No orders yet.
            </p>
          ) : (
            <div className="space-y-3">
              {customer.orders.map((order) => (
                <Link
                  key={order.id}
                  to={`/admin/orders/${order.id}`}
                  className="flex flex-col gap-3 rounded-[28px] border border-gold/20 bg-ivory-2 p-4 transition-colors hover:border-gold/40 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-navy">{order.order_number}</span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {format(new Date(order.placed_at), 'dd MMM yyyy · h:mm a')}
                      {' · '}
                      {order.order_items?.length || 0} item
                      {(order.order_items?.length || 0) === 1 ? '' : 's'}
                    </p>
                    {order.order_items?.length > 0 && (
                      <p className="mt-1 truncate text-sm text-muted">
                        {order.order_items.map((i) => i.product_name).join(', ')}
                      </p>
                    )}
                    {order.invoice_number && (
                      <div className="mt-2">
                        <InvoiceNumber number={order.invoice_number} compact />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-lg text-gold">{formatAED(order.total)}</span>
                    <ChevronRight className="h-4 w-4 text-muted" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {schemeEnabled && (
          <TabsContent value="enrollments">
            {!enrollmentCount ? (
              <p className="rounded-[28px] border border-gold/20 bg-ivory-2 p-8 text-center text-sm text-muted">
                Not enrolled in any gold scheme.
              </p>
            ) : (
              <div className="space-y-3">
                {customer.enrollments.map((enrollment) => {
                  const statusMeta = ENROLLMENT_STATUS[enrollment.status] || {
                    label: enrollment.status,
                    variant: 'muted',
                  }
                  const schemeName = enrollment.schemes?.name || 'Gold scheme'
                  const progress = enrollment.tenure_months
                    ? Math.round((enrollment.installments_paid / enrollment.tenure_months) * 100)
                    : 0
                  const installments = (enrollment.scheme_installments || []).sort(
                    (a, b) => a.installment_number - b.installment_number
                  )
                  const nextDue = getNextDueInstallment(installments)

                  return (
                    <Link
                      key={enrollment.id}
                      to={`/admin/schemes/enrollments/${enrollment.id}`}
                      className="block rounded-[28px] border border-gold/20 bg-ivory-2 p-4 transition-colors hover:border-gold/40 sm:p-5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-navy">{schemeName}</span>
                          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted" />
                      </div>
                      {enrollment.schemes?.description && (
                        <p className="mt-1 text-sm text-muted">{enrollment.schemes.description}</p>
                      )}
                      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-xs text-muted">Monthly</p>
                          <p className="font-medium text-navy">{formatAED(enrollment.monthly_amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted">Tenure</p>
                          <p className="font-medium text-navy">{enrollment.tenure_months} months</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted">Installments paid</p>
                          <p className="font-medium text-navy">
                            {enrollment.installments_paid} / {enrollment.tenure_months}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted">Next due</p>
                          <p className="font-medium text-navy">
                            {nextDue ? formatSchemeDate(nextDue.due_date) : '—'}
                          </p>
                        </div>
                      </div>
                      {enrollment.status === 'active' && (
                        <div className="mt-3">
                          <div className="h-1.5 overflow-hidden rounded-full bg-ivory-3">
                            <div
                              className="h-full rounded-full bg-gold transition-all"
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-muted">{progress}% complete</p>
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="wallet">
          <WalletHistory
            transactions={walletTxs}
            isLoading={walletLoading}
            balance={walletBalance}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
