import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Calendar, PiggyBank, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatINR } from '@/lib/pricing'
import { useSchemes } from '@/hooks/useSchemes'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'
import { Skeleton } from '@/components/ui/skeleton'
import { computeSchemePlanSummary } from '@/lib/schemeUtils'

const HOME_PLAN_LIMIT = 3

function PlanStatRow({ label, value, emphasize = false }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 py-2 last:border-0">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-gold-3/70">
        {label}
      </span>
      <span
        className={`min-w-0 truncate text-right text-sm font-semibold ${emphasize ? 'text-gold' : 'text-white'}`}
      >
        {value}
      </span>
    </div>
  )
}

function SchemePlanCard({ scheme }) {
  const { t } = useTranslation(['home', 'common', 'scheme'])
  const lang = useContentLang()
  const summary = computeSchemePlanSummary(scheme)
  const schemeName = pickField(scheme, 'name', lang)
  const schemeDescription = pickField(scheme, 'description', lang)
  const hasBonusMonths = summary.benefitType === 'bonus_months' && summary.bonus > 0
  const hasFixedBenefit = summary.benefitType === 'fixed_amount' && summary.benefitAmount > 0

  const benefitValue = hasBonusMonths
    ? t('scheme:bonusMonthsLabel', { count: summary.bonus })
    : hasFixedBenefit
      ? formatINR(summary.benefitAmount)
      : t('scheme:noBonus')

  const badgeLabel = hasBonusMonths
    ? t('scheme:bonusPlanBadge', { tenure: summary.tenure, bonus: summary.bonus })
    : hasFixedBenefit
      ? t('scheme:fixedBenefitBadge')
      : null

  return (
    <article className="flex h-full min-w-0 flex-col rounded-xl border border-gold/30 bg-navy-2/80 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 font-display text-xl leading-tight text-gold-3! sm:text-2xl">
          {schemeName}
        </h3>
        {badgeLabel ? (
          <span className="shrink-0 rounded-full border border-gold/40 bg-gold/15 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-gold">
            {badgeLabel}
          </span>
        ) : null}
      </div>
      {schemeDescription ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gold-3/80">{schemeDescription}</p>
      ) : null}

      <dl className="mt-4 flex-1 rounded-lg border border-white/10 bg-white/5 px-3">
        <PlanStatRow label={t('home:planMonthly')} value={formatINR(summary.monthly)} />
        <PlanStatRow
          label={t('home:planTenure')}
          value={t('common:monthTenure', { count: summary.tenure })}
        />
        <PlanStatRow label={t('home:planBenefit')} value={benefitValue} />
        <PlanStatRow label={t('home:planYouPay')} value={formatINR(summary.paidTotal)} />
        <PlanStatRow
          label={t('home:planYouReceive')}
          value={formatINR(summary.maturityValue)}
          emphasize
        />
      </dl>

      <Button asChild variant="gold" className="mt-4 w-full min-h-11!">
        <Link to="/scheme">
          {t('home:viewPlan')}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </article>
  )
}

export function SchemeSection() {
  const { t } = useTranslation(['home', 'common'])
  const lang = useContentLang()
  const { data: schemes, isLoading } = useSchemes()

  if (isLoading) {
    return (
      <section className="py-8 sm:py-10">
        <Skeleton className="mx-auto h-64 max-w-330 rounded-2xl sm:h-72" />
      </section>
    )
  }

  if (!schemes?.length) return null

  const primary = schemes[0]
  const previewSchemes = schemes.slice(0, HOME_PLAN_LIMIT)
  const remaining = schemes.length - previewSchemes.length
  const fallbackDesc = t('home:schemeFallbackDesc')
  const primaryDesc = pickField(primary, 'description', lang) || fallbackDesc

  return (
    <section className="py-8 sm:py-10">
      <div className="mx-auto max-w-330 px-4 sm:px-6">
        <div className="relative rounded-2xl border border-gold/25 bg-navy shadow-[0_16px_40px_rgba(12,23,48,0.28)]">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />

          <div className="relative p-5 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
              <div className="min-w-0 max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-3 py-1">
                  <PiggyBank className="h-4 w-4 text-gold" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-gold">
                    {t('home:schemeBadge')}
                  </span>
                </div>

                <h2 className="mt-4 font-display text-[clamp(1.5rem,4vw,2.25rem)] leading-tight text-white!">
                  {t('home:schemeTitle')}
                </h2>

                <p className="mt-3 text-sm leading-relaxed text-gold-3/85 sm:text-base">
                  {primaryDesc}
                </p>

                <ul className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {[
                    { icon: Calendar, textKey: 'schemeBenefit1' },
                    { icon: ShieldCheck, textKey: 'schemeBenefit2' },
                    { icon: Sparkles, textKey: 'schemeBenefit3' },
                  ].map(({ icon: Icon, textKey }) => (
                    <li
                      key={textKey}
                      className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gold-3 sm:max-w-[220px]"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-gold" />
                      {t(`home:${textKey}`)}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
                <Button asChild variant="gold" className="w-full sm:w-auto min-h-11! lg:w-full">
                  <Link to="/scheme">
                    {t('home:schemeCtaPrimary')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Link
                  to="/scheme"
                  className="text-center text-sm font-semibold text-gold-3 hover:text-white lg:text-right"
                >
                  {t('home:schemeCtaSecondary')}
                </Link>
              </div>
            </div>

            <div className="mt-8 border-t border-white/10 pt-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gold-3/60">
                  {t('home:availablePlans')}
                </p>
                {remaining > 0 ? (
                  <Link
                    to="/scheme"
                    className="text-xs font-semibold text-gold hover:text-gold-2"
                  >
                    {t('common:morePlansOnSchemePage', { count: remaining })}
                  </Link>
                ) : null}
              </div>

              <div
                className={`grid gap-4 ${
                  previewSchemes.length === 1
                    ? 'max-w-md'
                    : previewSchemes.length === 2
                      ? 'sm:grid-cols-2'
                      : 'sm:grid-cols-2 xl:grid-cols-3'
                }`}
              >
                {previewSchemes.map((scheme) => (
                  <SchemePlanCard key={scheme.id} scheme={scheme} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
