import { useState } from 'react'
import { format, subDays } from 'date-fns'
import { Download } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSalesReport, useTopProducts } from '@/hooks/useAdminReports'
import { useAdminLowStock } from '@/hooks/useAdminInventory'
import { formatAED } from '@/lib/pricing'
import { Skeleton } from '@/components/ui/skeleton'

function exportCsv(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function AdminReportsPage() {
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const { data: report, isLoading } = useSalesReport(from, to)
  const { data: topProducts } = useTopProducts(10, from, to)
  const { data: lowStock } = useAdminLowStock()

  const byDay = report?.by_day || []

  return (
    <div>
      <AdminPageHeader title="Reports" description="Paid sales only (Asia/Dubai day boundaries)." />
      <div className="mb-6 flex flex-wrap gap-3">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
        <Button
          variant="outline"
          onClick={() => {
            const rows = [
              ['Date', 'Sales', 'Orders'],
              ...byDay.map((d) => [d.date, d.total_sales, d.order_count]),
            ]
            exportCsv(`sales-${from}-${to}.csv`, rows)
          }}
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Total sales</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <p className="font-display text-2xl text-navy">{formatAED(report?.total_sales ?? 0)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Orders</CardTitle></CardHeader>
          <CardContent>
            <p className="font-display text-2xl text-navy">{report?.order_count ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Low stock SKUs</CardTitle></CardHeader>
          <CardContent>
            <p className="font-display text-2xl text-navy">{lowStock?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Top products</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topProducts?.length ? topProducts.map((p) => (
              <div key={p.product_id || p.product_name} className="flex justify-between text-sm">
                <span className="text-navy">{p.product_name}</span>
                <span className="text-muted">{p.qty_sold} sold · {formatAED(p.revenue ?? 0)}</span>
              </div>
            )) : <p className="text-sm text-muted">No data</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Daily breakdown</CardTitle></CardHeader>
          <CardContent className="max-h-64 space-y-2 overflow-y-auto">
            {byDay.length ? byDay.map((d) => (
              <div key={d.date} className="flex justify-between text-sm">
                <span className="text-muted">{d.date}</span>
                <span className="text-navy">{formatAED(d.total_sales ?? 0)} · {d.order_count} orders</span>
              </div>
            )) : <p className="text-sm text-muted">No data for range</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
