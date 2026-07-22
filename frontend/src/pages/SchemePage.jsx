import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { RequireCustomer } from '@/components/auth/RequireCustomer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/pricing'
import { useSchemes, useMyEnrollments, useEnrollScheme } from '@/hooks/useSchemes'
import { useStoreSettings } from '@/hooks/useStoreSettings'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'
import { Skeleton } from '@/components/ui/skeleton'
import { ENROLLMENT_STATUS, formatSchemeDate, getNextDueInstallment, schemeProgress } from '@/lib/schemeUtils'
import { getEnrollmentStatusLabel } from '@/lib/i18nLabels'
import { ChevronRight, PiggyBank } from 'lucide-react'
import { formatSchemeError } from '@/lib/schemeErrors'

function SchemePageContent() {
  const { t } = useTranslation(['scheme', 'common', 'errors'])
  const lang = useContentLang()
  const { data: settings } = useStoreSettings()
  const { data: schemes, isLoading } = useSchemes()
  const { data: enrollments } = useMyEnrollments()
  const enroll = useEnrollScheme()
  const navigate = useNavigate()

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

  const handleEnroll = async (scheme) => {
    try {
      const result = await enroll.mutateAsync({ scheme_id: scheme.id })
      toast.success(t('common:schemeEnrolled'))
      navigate(`/scheme/${result.enrollment_id}`)
    } catch (err) {
      toast.error(formatSchemeError(err))
    }
  }

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('scheme:eyebrow')}</p>
          <h1 className="font-display text-[clamp(28px,3.3vw,46px)] text-navy">{t('scheme:title')}</h1>
          <p className="mt-2 text-sm text-muted">{t('scheme:subtitle')}</p>
        </div>
        {enrollments?.length > 0 && (
          <Button asChild>
            <Link to="/scheme/track">
              <PiggyBank className="h-4 w-4" />
              {t('scheme:trackMyScheme')}
            </Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-[28px]" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {schemes?.map((scheme) => {
            const schemeName = pickField(scheme, 'name', lang)
            const schemeDescription = pickField(scheme, 'description', lang)
            const existingActiveEnrollment = (enrollments || []).find(
              (enrollment) =>
                enrollment.status === 'active' &&
                (enrollment.scheme_id === scheme.id ||
                  enrollment.schemes?.id === scheme.id ||
                  enrollment.scheme?.id === scheme.id)
            )
            return (
            <div
              key={scheme.id}
              className="rounded-[28px] border border-gold/20 bg-ivory-2 p-6 shadow-[0_14px_34px_rgba(7,21,37,.09)]"
            >
              <h2 className="font-display text-xl text-navy">{schemeName}</h2>
              {schemeDescription && (
                <p className="mt-2 text-sm text-muted">{schemeDescription}</p>
              )}
              <p className="mt-4 font-display text-2xl text-gold">
                {t('common:perMonth', { amount: formatINR(scheme.monthly_amount) })}
              </p>
              <p className="text-xs text-muted">
                {t('common:monthTenureLabel', { count: scheme.tenure_months })}
              </p>
              <div className="mt-4 space-y-2">
                <Button
                  className="w-full"
                  onClick={() => handleEnroll(scheme)}
                  disabled={enroll.isPending || !!existingActiveEnrollment}
                >
                  {existingActiveEnrollment ? 'Already enrolled' : t('scheme:enrollNow')}
                </Button>
                {existingActiveEnrollment && (
                  <Button variant="outline" className="w-full" asChild>
                    <Link to={`/scheme/${existingActiveEnrollment.id}`}>View scheme</Link>
                  </Button>
                )}
              </div>
            </div>
            )
          })}
        </div>
      )}

      {enrollments?.length > 0 && (
        <div className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl text-navy">{t('scheme:activeEnrollments')}</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/scheme/track">
                {t('scheme:viewAll')} <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="space-y-3">
            {enrollments.slice(0, 3).map((e) => {
              const nextDue = getNextDueInstallment(e.scheme_installments)
              const statusMeta = ENROLLMENT_STATUS[e.status] || ENROLLMENT_STATUS.active
              return (
                <Link
                  key={e.id}
                  to={`/scheme/${e.id}`}
                  className="flex items-center justify-between rounded-[28px] border border-gold/20 bg-ivory-2 p-4 transition-colors hover:border-gold/40 sm:p-5"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-navy">
                        {e.schemes ? pickField(e.schemes, 'name', lang) : ''}
                      </span>
                      <Badge variant={statusMeta.variant}>
                        {getEnrollmentStatusLabel(e.status, t)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {t('common:installmentProgressShort', {
                        paid: e.installments_paid,
                        total: e.tenure_months,
                        percent: schemeProgress(e),
                      })}
                    </p>
                    {nextDue && e.status === 'active' && (
                      <p className="mt-1 text-xs text-gold">
                        {t('common:nextDueDate', { date: formatSchemeDate(nextDue.due_date) })}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function SchemePage() {
  return (
    <RequireCustomer>
      <SchemePageContent />
    </RequireCustomer>
  )
}
