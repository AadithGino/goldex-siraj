import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, PiggyBank } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RequireCustomer } from '@/components/auth/RequireCustomer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { SchemePayDialog } from '@/components/scheme/SchemePayDialog'
import { useMyEnrollments } from '@/hooks/useSchemes'
import { useStoreSettings } from '@/hooks/useStoreSettings'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'
import {
  ENROLLMENT_STATUS,
  formatSchemeDate,
  getNextDueInstallment,
  schemeProgress,
} from '@/lib/schemeUtils'
import { getEnrollmentStatusLabel } from '@/lib/i18nLabels'
import { formatINR } from '@/lib/pricing'

function SchemeTrackContent() {
  const { t } = useTranslation(['scheme', 'common'])
  const lang = useContentLang()
  const { data: settings } = useStoreSettings()
  const { data: enrollments, isLoading } = useMyEnrollments()
  const [payInstallment, setPayInstallment] = useState(null)
  const onlinePaymentEnabled = settings?.online_payment_enabled === true

  if (settings && settings.gold_scheme_enabled === false) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-3xl text-navy">Gold scheme is currently unavailable.</h1>
        <p className="mt-2 text-sm text-muted">{t('scheme:unavailableDesc')}</p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/">{t('common:continueShopping')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('scheme:eyebrow')}</p>
          <h1 className="font-display text-[clamp(28px,3.3vw,46px)] text-navy">{t('scheme:trackMyScheme')}</h1>
          <p className="mt-2 text-sm text-muted">{t('scheme:trackSubtitle')}</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/scheme">{t('scheme:browsePlans')}</Link>
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-[28px]" />
      ) : !enrollments?.length ? (
        <div className="rounded-[28px] border border-gold/20 bg-ivory-2 p-10 text-center">
          <PiggyBank className="mx-auto h-10 w-10 text-gold" />
          <h2 className="mt-4 font-display text-xl text-navy">{t('scheme:noEnrollmentsTitle')}</h2>
          <p className="mt-2 text-sm text-muted">{t('scheme:noEnrollmentsDesc')}</p>
          <Button asChild className="mt-6">
            <Link to="/scheme">{t('scheme:viewGoldPlans')}</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {enrollments.map((e) => {
            const nextDue = getNextDueInstallment(e.scheme_installments)
            const statusMeta = ENROLLMENT_STATUS[e.status] || ENROLLMENT_STATUS.active
            const progress = schemeProgress(e)

            return (
              <div
                key={e.id}
                className="rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-xl text-navy">
                        {e.schemes ? pickField(e.schemes, 'name', lang) : ''}
                      </span>
                      <Badge variant={statusMeta.variant}>
                        {getEnrollmentStatusLabel(e.status, t)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {t('common:perMonth', { amount: formatINR(e.monthly_amount) })}
                      {' · '}
                      {t('common:startedDate', { date: formatSchemeDate(e.start_date) })}
                    </p>
                    <p className="mt-2 text-sm text-navy">
                      {t('common:installmentProgress', {
                        paid: e.installments_paid,
                        total: e.tenure_months,
                        percent: progress,
                      })}
                    </p>
                    {nextDue && e.status === 'active' && (
                      <p className="mt-2 text-sm font-medium text-gold">
                        {t('common:nextDueWithAmount', {
                          date: formatSchemeDate(nextDue.due_date),
                          amount: formatINR(nextDue.amount),
                        })}
                      </p>
                    )}
                    <div className="mt-3 h-1.5 max-w-xs overflow-hidden rounded-full bg-ivory-3">
                      <div
                        className="h-full rounded-full bg-gold"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    {!onlinePaymentEnabled && e.status === 'active' && (
                      <p className="mt-2 text-xs text-muted">
                        Installment payment is currently accepted at store.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {nextDue && e.status === 'active' && onlinePaymentEnabled && (
                      <Button size="sm" onClick={() => setPayInstallment(nextDue)}>
                        {t('scheme:payNow')}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/scheme/${e.id}`}>
                        {t('scheme:viewDetails')}
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <SchemePayDialog
        open={!!payInstallment}
        onOpenChange={(open) => !open && setPayInstallment(null)}
        installment={payInstallment}
        onlinePaymentEnabled={onlinePaymentEnabled}
      />
    </div>
  )
}

export function SchemeTrackPage() {
  return (
    <RequireCustomer>
      <SchemeTrackContent />
    </RequireCustomer>
  )
}
