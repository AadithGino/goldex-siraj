import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { SchemePayDialog } from '@/components/scheme/SchemePayDialog'
import { useMyEnrollments } from '@/hooks/useSchemes'
import { useStoreSettings } from '@/hooks/useStoreSettings'
import {
  ENROLLMENT_STATUS,
  formatSchemeDate,
  getNextDueInstallment,
  schemeProgress,
} from '@/lib/schemeUtils'
import { getEnrollmentStatusLabel } from '@/lib/i18nLabels'
import { formatINR } from '@/lib/pricing'

export function SchemeAccountTab() {
  const { t } = useTranslation(['scheme', 'common'])
  const { data: enrollments, isLoading } = useMyEnrollments()
  const { data: settings } = useStoreSettings()
  const [payInstallment, setPayInstallment] = useState(null)
  const onlinePaymentEnabled = settings?.online_payment_enabled === true

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-[28px]" />
  }

  if (!enrollments?.length) {
    return (
      <div className="max-w-lg rounded-[28px] border border-gold/20 bg-ivory-2 p-8 text-center">
        <h2 className="font-display text-lg text-navy">{t('scheme:accountEmptyTitle')}</h2>
        <p className="mt-2 text-sm text-muted">{t('scheme:accountEmptyDesc')}</p>
        <Button asChild className="mt-4">
          <Link to="/scheme">{t('scheme:browsePlans')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-navy">{t('scheme:accountTitle')}</h2>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/scheme/track">{t('scheme:fullDashboard')}</Link>
        </Button>
      </div>

      {enrollments.map((e) => {
        const nextDue = getNextDueInstallment(e.scheme_installments)
        const statusMeta = ENROLLMENT_STATUS[e.status] || ENROLLMENT_STATUS.active

        return (
          <div
            key={e.id}
            className="rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-navy">{e.schemes?.name}</span>
              <Badge variant={statusMeta.variant}>{getEnrollmentStatusLabel(e.status, t)}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted">
              {t('common:perMonth', { amount: formatINR(e.monthly_amount) })}
              {' · '}
              {t('common:installmentProgressShort', {
                paid: e.installments_paid,
                total: e.tenure_months,
                percent: schemeProgress(e),
              })}
            </p>
            {nextDue && e.status === 'active' && (
              <p className="mt-1 text-sm text-gold">
                {t('common:dueDate', { date: formatSchemeDate(nextDue.due_date) })}
                {' · '}
                {formatINR(nextDue.amount)}
              </p>
            )}
            {!onlinePaymentEnabled && e.status === 'active' && (
              <p className="mt-2 text-xs text-muted">
                Installment payment is currently accepted at store.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {nextDue && e.status === 'active' && onlinePaymentEnabled && (
                <Button size="sm" onClick={() => setPayInstallment(nextDue)}>
                  {t('scheme:payInstallment')}
                </Button>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link to={`/scheme/${e.id}`}>
                  {t('scheme:details')}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        )
      })}

      <SchemePayDialog
        open={!!payInstallment}
        onOpenChange={(open) => !open && setPayInstallment(null)}
        installment={payInstallment}
        onlinePaymentEnabled={onlinePaymentEnabled}
      />
    </div>
  )
}
