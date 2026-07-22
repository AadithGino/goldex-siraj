import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  SchemeEnrollmentSummary,
  SchemeInstallmentTimeline,
} from '@/components/scheme/SchemeEnrollmentCard'
import { SchemeRecordPaymentDialog } from '@/components/scheme/SchemeRecordPaymentDialog'
import {
  useAdminSchemeEnrollment,
  useAdminSchemeMutations,
} from '@/hooks/useSchemes'
import { formatAED } from '@/lib/pricing'
import { formatDateSafe } from '@/lib/date'
import { formatDubaiBusinessDate, isDubaiBusinessDateReached } from '@/lib/dubaiTime'
import { paymentMethodLabel } from '@/lib/schemeUtils'
import { useStaffRole } from '@/hooks/useStaffRole'
import { formatSchemeError } from '@/lib/schemeErrors'

export function AdminSchemeEnrollmentDetailPage() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const { isOwner, isManager, isStaff } = useStaffRole()
  const canRecordSchemePayments = isOwner || isManager || isStaff
  const canCancelSchemeEnrollment = isOwner || isManager
  const canCompleteScheme = isOwner || isManager
  const { data: enrollment, isLoading } = useAdminSchemeEnrollment(id)
  const { updateEnrollmentStatus, completeEnrollment } = useAdminSchemeMutations()
  const [recordInstallment, setRecordInstallment] = useState(null)

  const installments = enrollment?.scheme_installments || []
  const paidInstallments = installments.filter((inst) => inst.payment_status === 'paid')
  const tenure = Number(enrollment?.tenure_months_snapshot || enrollment?.schemes?.tenure_months || 0)
  const totalPaid = Number(enrollment?.total_paid || 0)
  const finalDueDate = installments.length
    ? installments.reduce((latest, inst) => {
      if (!inst.due_date) return latest
      if (!latest) return inst.due_date
      return new Date(inst.due_date) > new Date(latest) ? inst.due_date : latest
    }, null)
    : null
  const maturityAt = enrollment?.maturity_at || finalDueDate
  const matured = isDubaiBusinessDateReached(maturityAt)
  const monthlyAmount = Number(
    enrollment?.monthly_amount_snapshot || enrollment?.schemes?.monthly_amount || 0,
  )
  const bonusMonths = Number(enrollment?.bonus_months_snapshot || enrollment?.schemes?.bonus_months || 0)
  const tenureMonths = Number(enrollment?.tenure_months_snapshot || enrollment?.schemes?.tenure_months || 0)
  const serverPayout = monthlyAmount * (tenureMonths + bonusMonths)
  const eligibleForCompletion =
    canCompleteScheme
    && enrollment?.status === 'active'
    && paidInstallments.length >= tenure
    && matured === true

  const refetchEnrollmentDetail = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-scheme-enrollment', id] })
    await queryClient.refetchQueries({ queryKey: ['admin-scheme-enrollment', id] })
  }

  const handleCreditPayout = async () => {
    if (!window.confirm(`Credit ${formatAED(serverPayout)} to wallet and complete this scheme?`)) return
    try {
      await completeEnrollment.mutateAsync({
        enrollmentId: id,
        note: 'Maturity verified',
      })
      await refetchEnrollmentDetail()
      toast.success('Scheme payout credited successfully.')
    } catch (e) {
      toast.error(formatSchemeError(e))
    }
  }

  const handleStatusChange = async (status) => {
    const warningText = `Cancel this scheme enrollment?

Paid installments will remain marked as paid.
Pending and overdue installments will be cancelled.
No automatic refund is issued for paid installments.
This cannot be reactivated later.`
    if (!window.confirm(warningText)) return
    try {
      await updateEnrollmentStatus.mutateAsync({
        enrollmentId: id,
        status,
        reason: 'Customer requested cancellation',
      })
      await refetchEnrollmentDetail()
      toast.success('Scheme enrollment cancelled.')
    } catch (e) {
      toast.error(formatSchemeError(e))
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

  if (!enrollment) {
    return (
      <div className="text-center">
        <p className="text-muted">Enrollment not found.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/admin/schemes">Back to schemes</Link>
        </Button>
      </div>
    )
  }

  const customer = enrollment.customers

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
        <Link to="/admin/schemes">
          <ChevronLeft className="h-4 w-4" />
          Gold schemes
        </Link>
      </Button>

      <AdminPageHeader
        title={enrollment.schemes?.name || 'Scheme enrollment'}
        description={
          customer
            ? `${customer.full_name || 'Customer'} · ${customer.phone || 'No phone'}${customer.email ? ` · ${customer.email}` : ''}`
            : undefined
        }
        action={
          <div className="flex flex-wrap gap-2">
            {enrollment.status === 'active' && canCancelSchemeEnrollment && (
              <Button variant="outline" onClick={() => handleStatusChange('cancelled')}>
                Cancel enrollment
              </Button>
            )}
            {customer && (
              <Button variant="outline" asChild>
                <Link to={`/admin/customers/${customer.id}`}>View customer</Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant={enrollment.status === 'active' ? 'success' : 'muted'}>
          {enrollment.status}
        </Badge>
        <Badge variant="outline">
          Enrolled {formatDateSafe(enrollment.start_date || enrollment.started_at, 'dd MMM yyyy')}
        </Badge>
      </div>

      {enrollment.status === 'active' && canCompleteScheme && (
        <div className="mb-6 rounded-2xl border border-gold/20 bg-ivory-2 p-4">
          <p className="text-sm font-medium text-navy">Complete scheme / credit wallet</p>
          <p className="mt-1 text-xs text-muted">
            Eligible when all installments are paid and maturity is reached. Payout is calculated by the server from enrollment snapshots.
          </p>
          <div className="mt-3 space-y-1 rounded-xl border border-gold/20 bg-white px-3 py-2.5 text-xs">
            <p className="text-navy">
              Installments paid: <span className="font-semibold">{paidInstallments.length} / {tenure}</span>
            </p>
            <p className="text-navy">
              Total paid: <span className="font-semibold">{formatAED(totalPaid)}</span>
            </p>
            <p className="text-navy">
              Maturity:{' '}
              <span className="font-semibold">
                {maturityAt ? formatDubaiBusinessDate(maturityAt) : '—'}
              </span>
            </p>
            <p className="text-navy">
              Matured: <span className="font-semibold">{matured ? 'Yes' : 'No'}</span>
            </p>
            <p className="text-navy">
              Server payout: <span className="font-semibold">{formatAED(serverPayout)}</span>
            </p>
          </div>
          <div className="mt-3">
            <Button
              onClick={handleCreditPayout}
              disabled={completeEnrollment.isPending || !eligibleForCompletion}
            >
              {completeEnrollment.isPending ? 'Crediting…' : 'Credit wallet & complete'}
            </Button>
          </div>
          {!eligibleForCompletion && (
            <p className="mt-2 text-xs text-muted">
              Completion is enabled only after all installments are paid and the scheme has matured.
            </p>
          )}
        </div>
      )}

      {enrollment.status === 'completed' && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">Scheme completed</p>
          <div className="mt-2 space-y-1 text-xs text-emerald-800">
            <p>
              Payout credited:{' '}
              <span className="font-semibold">
                {formatAED(Number(enrollment.payout_amount || serverPayout || 0))}
              </span>
            </p>
            <p>
              Completed on:{' '}
              <span className="font-semibold">
                {formatDateSafe(enrollment.completed_at, 'dd MMM yyyy')}
              </span>
            </p>
          </div>
        </div>
      )}

      <SchemeEnrollmentSummary enrollment={enrollment} />

      <div className="mt-8">
        <h2 className="mb-4 font-display text-lg text-navy">Installment ledger</h2>
        <SchemeInstallmentTimeline
          installments={enrollment.scheme_installments}
          enrollment={enrollment}
          adminActions={(inst) =>
            canRecordSchemePayments
            && (inst.payment_status === 'pending' || inst.payment_status === 'overdue')
            && enrollment.status === 'active' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRecordInstallment(inst)}
              >
                Record payment
              </Button>
              ) : inst.payment_status === 'paid' ? (
                <span className="text-xs text-muted">{paymentMethodLabel(inst.payment_method)}</span>
              ) : null
          }
        />
      </div>

      <SchemeRecordPaymentDialog
        open={!!recordInstallment}
        onOpenChange={(open) => !open && setRecordInstallment(null)}
        installment={recordInstallment}
        canRecordSchemePayments={canRecordSchemePayments}
        onSuccess={refetchEnrollmentDetail}
      />
    </div>
  )
}
