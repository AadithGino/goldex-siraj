import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { RequireCustomer } from '@/components/auth/RequireCustomer'
import { SchemeEnrollDialog } from '@/components/scheme/SchemeEnrollDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/pricing'
import { useSchemes, useMyEnrollments, useEnrollScheme } from '@/hooks/useSchemes'
import { useStoreSettings } from '@/hooks/useStoreSettings'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ENROLLMENT_STATUS,
  computeSchemePlanSummary,
  formatSchemeDate,
  getNextDueInstallment,
  schemeProgress,
} from '@/lib/schemeUtils'
import { getEnrollmentStatusLabel } from '@/lib/i18nLabels'
import { ChevronRight, Gift, PiggyBank, Sparkles } from 'lucide-react'
import { formatSchemeError } from '@/lib/schemeErrors'

function SchemePlanCard({ scheme, existingActiveEnrollment, onEnroll, enrollPending }) {
  const { t } = useTranslation(['scheme', 'common'])
  const lang = useContentLang()
  const schemeName = pickField(scheme, 'name', lang)
  const schemeDescription = pickField(scheme, 'description', lang)
  const summary = computeSchemePlanSummary(scheme)
  const hasBonusMonths = summary.benefitType === 'bonus_months' && summary.bonus > 0
  const hasFixedBenefit = summary.benefitType === 'fixed_amount' && summary.benefitAmount > 0
  const hasBenefit = hasBonusMonths || hasFixedBenefit

  const benefitLabel = hasBonusMonths
    ? t('scheme:bonusMonthsLabel', { count: summary.bonus })
    : hasFixedBenefit
      ? t('scheme:fixedBenefitLabel', { amount: formatINR(summary.benefitAmount) })
      : t('scheme:noBonus')

  const badgeLabel = hasBonusMonths
    ? t('scheme:bonusPlanBadge', { tenure: summary.tenure, bonus: summary.bonus })
    : hasFixedBenefit
      ? t('scheme:fixedBenefitBadge')
      : t('common:monthTenure', { count: summary.tenure })

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-gold/25 bg-ivory-2 shadow-[0_14px_34px_rgba(7,21,37,.08)] transition-shadow hover:border-gold/45 hover:shadow-[0_18px_40px_rgba(7,21,37,.12)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold/40 via-gold to-gold/40" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold/10 blur-2xl" />

      <div className="relative flex flex-1 flex-col p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl leading-tight text-navy">{schemeName}</h2>
            {schemeDescription ? (
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{schemeDescription}</p>
            ) : null}
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold/35 bg-gold/10 px-3 py-1 text-xs font-bold tracking-wide text-gold">
            <Sparkles className="h-3.5 w-3.5" />
            {badgeLabel}
          </span>
        </div>

        <p className="mt-5 font-display text-[clamp(1.75rem,4vw,2.25rem)] leading-none text-gold">
          {t('common:perMonth', { amount: formatINR(summary.monthly) })}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-gold/15 bg-ivory-3/80 px-3.5 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              {t('scheme:planTenure')}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-navy">
              {t('common:monthTenure', { count: summary.tenure })}
            </dd>
          </div>
          <div className="rounded-2xl border border-gold/15 bg-ivory-3/80 px-3.5 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              {t('scheme:planBenefit')}
            </dt>
            <dd className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-navy">
              {hasBenefit ? <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" /> : null}
              <span>{benefitLabel}</span>
            </dd>
          </div>
        </dl>

        <div className="mt-4 rounded-2xl border border-navy/10 bg-navy px-4 py-4 text-white">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gold-3/70">
                {t('scheme:planYouPay')}
              </p>
              <p className="mt-1 font-display text-lg text-gold-3">{formatINR(summary.paidTotal)}</p>
            </div>
            <ChevronRight className="mb-1 h-4 w-4 shrink-0 text-gold/60" />
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gold">
                {t('scheme:planYouReceive')}
              </p>
              <p className="mt-1 font-display text-xl text-gold">{formatINR(summary.maturityValue)}</p>
            </div>
          </div>
          {hasBenefit ? (
            <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-relaxed text-gold-3/75">
              {t('scheme:maturityHint')}
            </p>
          ) : null}
        </div>

        <div className="mt-auto space-y-2 pt-5">
          <Button
            className="w-full"
            onClick={() => onEnroll(scheme)}
            disabled={enrollPending || !!existingActiveEnrollment}
          >
            {existingActiveEnrollment ? t('scheme:alreadyEnrolled') : t('scheme:enrollNow')}
          </Button>
          {existingActiveEnrollment ? (
            <Button variant="outline" className="w-full" asChild>
              <Link to={`/scheme/${existingActiveEnrollment.id}`}>{t('scheme:viewScheme')}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function SchemePageContent() {
  const { t } = useTranslation(['scheme', 'common', 'errors'])
  const lang = useContentLang()
  const { data: settings } = useStoreSettings()
  const { data: schemes, isLoading } = useSchemes()
  const { data: enrollments } = useMyEnrollments()
  const enroll = useEnrollScheme()
  const navigate = useNavigate()
  const [enrollScheme, setEnrollScheme] = useState(null)

  if (settings && settings.gold_scheme_enabled === false) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-3xl text-navy">{t('scheme:unavailableTitle')}</h1>
        <p className="mt-2 text-sm text-muted">{t('scheme:unavailableDesc')}</p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/">{t('common:continueShopping')}</Link>
        </Button>
      </div>
    )
  }

  const handleEnroll = async (payload) => {
    try {
      const result = await enroll.mutateAsync(payload)
      toast.success(t('common:schemeEnrolled'))
      navigate(`/scheme/${result.enrollment_id}`)
    } catch (err) {
      toast.error(formatSchemeError(err))
      throw err
    }
  }

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('scheme:eyebrow')}</p>
          <h1 className="font-display text-[clamp(28px,3.3vw,46px)] text-navy">{t('scheme:title')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t('scheme:subtitle')}</p>
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
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[420px] w-full rounded-[28px]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {schemes?.map((scheme) => {
            const existingActiveEnrollment = (enrollments || []).find(
              (enrollment) =>
                enrollment.status === 'active' &&
                (enrollment.scheme_id === scheme.id ||
                  enrollment.schemes?.id === scheme.id ||
                  enrollment.scheme?.id === scheme.id),
            )
            return (
              <SchemePlanCard
                key={scheme.id}
                scheme={scheme}
                existingActiveEnrollment={existingActiveEnrollment}
                onEnroll={setEnrollScheme}
                enrollPending={enroll.isPending}
              />
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
      <SchemeEnrollDialog
        open={!!enrollScheme}
        onOpenChange={(open) => !open && setEnrollScheme(null)}
        scheme={enrollScheme}
        onConfirm={handleEnroll}
        isSubmitting={enroll.isPending}
      />
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
