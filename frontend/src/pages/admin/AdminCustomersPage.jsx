import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Search, Download, ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminCustomers, useAdminCustomerMutations, CUSTOMERS_PAGE_SIZE } from '@/hooks/useAdminCustomers'

function exportCustomersCsv(customers) {
  const header = ['Name', 'Phone', 'Email', 'Status', 'Joined']
  const rows = customers.map((c) => [
    c.full_name || '',
    c.phone || '',
    c.email || '',
    c.is_active ? 'Active' : 'Inactive',
    format(new Date(c.created_at), 'dd MMM yyyy'),
  ])
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `customers-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function AdminCustomersPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useAdminCustomers({ search, status: statusFilter, page })
  const customers = data?.customers || []
  const total = data?.total || 0
  const totalPages = data?.pages || 1
  const toggleActive = useAdminCustomerMutations()

  const handleToggle = async (e, customer) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await toggleActive.mutateAsync({ id: customer.id, is_active: !customer.is_active })
      toast.success(customer.is_active ? 'Customer deactivated' : 'Customer activated')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Customers"
        description="View customer profiles, orders, and scheme enrollments."
        action={
          customers.length ? (
            <Button variant="outline" size="sm" onClick={() => exportCustomersCsv(customers)}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          ) : null
        }
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search name, phone, email…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {['all', 'active', 'inactive'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => { setStatusFilter(f); setPage(1) }}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === f
                  ? 'border-[var(--navy)] bg-[var(--navy)] text-[var(--ivory-2)]'
                  : 'border-gold/30 text-navy hover:border-gold'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-[28px]" />)}
        </div>
      ) : !customers.length ? (
        <p className="text-sm text-muted">
          {search || statusFilter !== 'all' ? 'No customers match your filters.' : 'No customers yet.'}
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted">
            {total} customer{total !== 1 ? 's' : ''} · page {page} of {totalPages}
            {customers.length < CUSTOMERS_PAGE_SIZE ? '' : ''}
          </p>
          <div className="space-y-3">
            {customers.map((c) => (
              <Link
                key={c.id}
                to={`/admin/customers/${c.id}`}
                className="flex flex-col gap-3 rounded-[28px] border border-gold/20 bg-ivory-2 p-4 transition-colors hover:border-gold/40 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-navy">{c.full_name || 'Unnamed'}</span>
                    <Badge variant={c.is_active ? 'success' : 'destructive'}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {c.phone}{c.email ? ` · ${c.email}` : ''}
                  </p>
                  <p className="text-xs text-muted">
                    Joined {format(new Date(c.created_at), 'dd MMM yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleToggle(e, c)}
                  >
                    {c.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs text-muted">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
