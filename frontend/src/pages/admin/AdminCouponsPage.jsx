import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  useAdminCoupons,
  useAdminCouponMutations,
  useAdminCouponUsageSummary,
} from '@/hooks/useAdminCoupons'
import { useStaffRole } from '@/hooks/useStaffRole'
import { CouponFormDialog } from '@/components/admin/coupons/CouponFormDialog'
import { formatAED } from '@/lib/pricing'
import { formatDateSafe } from '@/lib/date'
import { CouponUsageDialog } from '@/components/admin/coupons/CouponUsageDialog'

const PAGE_SIZE = 25

export function AdminCouponsPage() {
  const { canManageCatalog } = useStaffRole()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const { data: listResult } = useAdminCoupons(canManageCatalog, {
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
  })
  const coupons = listResult?.data ?? []
  const meta = listResult?.meta
  const totalPages = Math.max(1, Number(meta?.pages) || 1)
  const { data: summaryRows = [] } = useAdminCouponUsageSummary(canManageCatalog)
  const { remove } = useAdminCouponMutations()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [usageOpen, setUsageOpen] = useState(false)
  const [usageCoupon, setUsageCoupon] = useState(null)

  const summaryByCoupon = Object.fromEntries(summaryRows.map((row) => [row.coupon_id, row]))

  if (!canManageCatalog) {
    return <p className="text-muted">You don&apos;t have permission to manage coupons.</p>
  }

  return (
    <div>
      <AdminPageHeader
        title="Coupons"
        description="Create and manage discount codes for checkout."
        action={
          <Button onClick={() => { setEditing(null); setOpen(true) }}>
            <Plus className="h-4 w-4" /> Add coupon
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          placeholder="Search code…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        {meta && (
          <p className="text-xs text-muted">
            Page {meta.page || page} of {totalPages} · {meta.total ?? 0} total
          </p>
        )}
      </div>
      <div className="space-y-3">
        {coupons.map((c) => {
          const analytics = summaryByCoupon[c.id]
          const activeUsageCount = Number(analytics?.active_usage_count ?? 0)
          const rolledBackCount = Number(analytics?.rolled_back_count ?? 0)
          const uniqueCustomerCount = Number(analytics?.unique_customer_count ?? 0)
          const totalActiveDiscount = Number(analytics?.total_active_discount ?? 0)
          const lifetimeUsageCount = Number(analytics?.lifetime_usage_count ?? 0)

          return (
          <div
            key={c.id}
            className="flex flex-col gap-3 rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg text-navy">{c.code}</span>
                <Badge variant={c.is_active ? 'success' : 'muted'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                {c.discount_type === 'percent' ? `${c.discount_value}% off` : `${formatAED(c.discount_value)} off`}
                {c.min_order > 0 && ` · Min ${formatAED(c.min_order)}`}
              </p>
              <p className="mt-1 text-sm text-muted">
                {'Used: '}{activeUsageCount}{c.usage_limit ? `/${c.usage_limit}` : '/unlimited'}
                {' · Active discount: '}{formatAED(totalActiveDiscount)}
                {' · Rolled back: '}{rolledBackCount}
                {' · Unique customers: '}{uniqueCustomerCount}
              </p>
              {lifetimeUsageCount > activeUsageCount && (
                <p className="mt-1 text-xs text-muted">
                  Lifetime usage: {lifetimeUsageCount} (includes rolled back)
                </p>
              )}
              {c.valid_to && (
                <p className="mt-1 text-xs text-muted">
                  Valid till {formatDateSafe(c.valid_to, 'dd MMM yyyy, HH:mm')}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUsageCoupon(c)
                  setUsageOpen(true)
                }}
              >
                View usage
              </Button>
              <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true) }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="text-muted hover:text-[#b3261e]" onClick={async () => {
                if (!confirm('Remove this coupon? If it has usage history it will be archived (deactivated) instead of permanently deleted.')) return
                try {
                  const result = await remove.mutateAsync(c.id)
                  toast.success(result?.archived ? 'Coupon archived (usage history preserved)' : 'Coupon deleted')
                } catch (e) {
                  toast.error(e.message)
                }
              }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
          )
        })}
      </div>
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            Next
          </Button>
        </div>
      )}
      <CouponFormDialog open={open} onOpenChange={setOpen} coupon={editing} />
      <CouponUsageDialog open={usageOpen} onOpenChange={setUsageOpen} coupon={usageCoupon} />
    </div>
  )
}
