import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, ChevronRight, Search } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  useAdminSchemes,
  useAdminSchemeEnrollments,
} from '@/hooks/useSchemes'
import { SchemeFormDialog } from '@/components/admin/schemes/SchemeFormDialog'
import { formatAED } from '@/lib/pricing'
import { ENROLLMENT_STATUS, formatSchemeDate, getNextDueInstallment, schemeProgress } from '@/lib/schemeUtils'
import { useStaffRole } from '@/hooks/useStaffRole'
import { ArabicContentBadge } from '@/components/admin/shared/LocaleFieldTabs'
import { hasArabicContent } from '@/lib/contentLocale'

const PAGE_SIZE = 25

export function AdminSchemesPage() {
  const { isOwner, isManager, isStaff } = useStaffRole()
  const canViewSchemes = isOwner || isManager || isStaff
  const canManageSchemePlans = isOwner || isManager
  const [enrollmentPage, setEnrollmentPage] = useState(1)
  const [schemePage, setSchemePage] = useState(1)
  const [search, setSearch] = useState('')
  const { data: schemesResult } = useAdminSchemes({ page: schemePage, limit: PAGE_SIZE })
  const { data: enrollmentsResult } = useAdminSchemeEnrollments({
    page: enrollmentPage,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
  })
  const schemes = schemesResult?.data ?? []
  const schemeMeta = schemesResult?.meta
  const enrollments = enrollmentsResult?.data ?? []
  const enrollmentMeta = enrollmentsResult?.meta
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  if (!canViewSchemes) return <p className="text-muted">No permission.</p>

  const overdueCount = enrollments.filter((e) => {
    const next = getNextDueInstallment(e.scheme_installments)
    return next?.payment_status === 'overdue' && e.status === 'active'
  }).length
  const enrollmentPages = Math.max(1, Number(enrollmentMeta?.pages) || 1)
  const schemePages = Math.max(1, Number(schemeMeta?.pages) || 1)

  return (
    <div>
      <AdminPageHeader
        title="Gold schemes"
        description="Manage savings plans, track enrollments, due dates, and installment payments."
        action={canManageSchemePlans ? (
          <Button onClick={() => { setEditing(null); setOpen(true) }}>
            <Plus className="h-4 w-4" />
            Add plan
          </Button>
        ) : null}
      />

      {overdueCount > 0 && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-navy">
          {overdueCount} enrollment{overdueCount === 1 ? '' : 's'} with overdue installments on this page
        </p>
      )}

      <Tabs defaultValue="enrollments">
        <TabsList className="mb-6">
          <TabsTrigger value="enrollments">
            Enrollments {enrollmentMeta?.total != null ? `(${enrollmentMeta.total})` : ''}
          </TabsTrigger>
          {canManageSchemePlans && <TabsTrigger value="plans">Plans</TabsTrigger>}
        </TabsList>

        <TabsContent value="enrollments">
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setEnrollmentPage(1) }}
                placeholder="Search customer, phone, scheme..."
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-3">
            {enrollments.map((e) => {
              const nextDue = getNextDueInstallment(e.scheme_installments)
              const statusMeta = ENROLLMENT_STATUS[e.status] || ENROLLMENT_STATUS.active
              const isOverdue = nextDue?.payment_status === 'overdue'

              return (
                <Link
                  key={e.id}
                  to={`/admin/schemes/enrollments/${e.id}`}
                  className="flex flex-col gap-3 rounded-[28px] border border-gold/20 bg-ivory-2 p-4 transition-colors hover:border-gold/40 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-navy">{e.schemes?.name}</span>
                      <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      {isOverdue && <Badge variant="destructive">Overdue</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {e.customers?.full_name || 'Customer'} · {e.customers?.phone || '—'}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Progress {schemeProgress(e)}%
                      {nextDue ? ` · Next due ${formatSchemeDate(nextDue.due_date)}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted" />
                </Link>
              )
            })}
          </div>
          {enrollmentPages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" disabled={enrollmentPage <= 1} onClick={() => setEnrollmentPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <Button variant="outline" size="sm" disabled={enrollmentPage >= enrollmentPages} onClick={() => setEnrollmentPage((p) => Math.min(enrollmentPages, p + 1))}>Next</Button>
            </div>
          )}
        </TabsContent>

        {canManageSchemePlans && (
          <TabsContent value="plans">
            <div className="space-y-3">
              {schemes.map((scheme) => (
                <div
                  key={scheme.id}
                  className="flex flex-col gap-3 rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg text-navy">{scheme.name}</span>
                      <Badge variant={scheme.is_active ? 'success' : 'muted'}>
                        {scheme.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <ArabicContentBadge show={hasArabicContent(scheme, ['name', 'description'])} />
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {formatAED(scheme.monthly_amount)} / month · {scheme.tenure_months} months
                      {scheme.bonus_months ? ` · ${scheme.bonus_months} bonus` : ''}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(scheme); setOpen(true) }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            {schemePages > 1 && (
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" disabled={schemePage <= 1} onClick={() => setSchemePage((p) => Math.max(1, p - 1))}>Previous</Button>
                <Button variant="outline" size="sm" disabled={schemePage >= schemePages} onClick={() => setSchemePage((p) => Math.min(schemePages, p + 1))}>Next</Button>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      <SchemeFormDialog open={open} onOpenChange={setOpen} scheme={editing} />
    </div>
  )
}
