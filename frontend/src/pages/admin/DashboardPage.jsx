import { formatAED } from '@/lib/pricing'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminDashboard } from '@/hooks/useAdminDashboard'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

const STATUS_ORDER = ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'partially_returned', 'cancelled', 'returned']

function StatCard({ label, value, loading }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="font-display text-2xl text-navy">{value}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const { data, isLoading, isError, error } = useAdminDashboard()

  const ordersByStatus = data?.orders_by_status || {}
  const statusEntries = Object.entries(ordersByStatus).sort(([a], [b]) => {
    const ai = STATUS_ORDER.indexOf(a)
    const bi = STATUS_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  const ordersByStatusTotal = statusEntries.reduce((sum, [, count]) => sum + Number(count || 0), 0)

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        description="Store overview (Asia/Dubai). Sales exclude cancelled, returned, and unpaid online checkouts."
      />

      {isError && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#b3261e]">
          Could not load dashboard: {error?.message || 'Unknown error'}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Today's sales"
          value={formatAED(data?.today_sales ?? 0)}
          loading={isLoading}
        />
        <StatCard
          label="Month sales"
          value={formatAED(data?.month_sales ?? 0)}
          loading={isLoading}
        />
        <StatCard
          label="Orders today"
          value={data?.orders_today ?? 0}
          loading={isLoading}
        />
        <StatCard
          label="Low / out of stock"
          value={data?.low_stock_count ?? 0}
          loading={isLoading}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
            <p className="text-xs text-muted">All time · {ordersByStatusTotal} total</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : statusEntries.length ? (
              statusEntries.map(([status, count]) => (
                <div key={status} className="flex justify-between text-sm">
                  <span className="capitalize text-muted">{status.replace(/_/g, ' ')}</span>
                  <span className="font-semibold text-navy">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">No order data yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Pending orders</span>
              <span className="font-semibold text-navy">{data?.pending_orders ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Pending reviews</span>
              <span className="font-semibold text-navy">{data?.pending_reviews ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Pending returns</span>
              <span className="font-semibold text-navy">{data?.pending_returns ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Active customers</span>
              <span className="font-semibold text-navy">{data?.active_customer_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Month orders (paid)</span>
              <span className="font-semibold text-navy">{data?.month_orders ?? 0}</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/orders?status=placed">View new orders</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/orders?status=pending_requests">Needs action</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/reviews?status=pending">Pending reviews</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/inventory">Low stock</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
