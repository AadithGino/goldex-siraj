import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Calendar, PiggyBank, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatINR } from '@/lib/pricing'
import { useSchemes } from '@/hooks/useSchemes'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'
import { Skeleton } from '@/components/ui/skeleton'

function PlanStatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 py-2.5 last:border-0">
      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-gold-3/70">
        {label}
      </span>
      <span className="min-w-0 text-right text-sm font-semibold text-white">{value}</span>
    </div>
  )
}

function SchemePlanCard({ scheme }) {
  const { t } = useTranslation(['home', 'common'])
  const lang = useContentLang()
  const planTotal = Number(scheme.monthly_amount) * Number(scheme.tenure_months)
  const schemeName = pickField(scheme, 'name', lang)
  const schemeDescription = pickField(scheme, 'description', lang)

  return (
    <article className="rounded-xl border border-gold/30 bg-navy-2/80 p-4 sm:p-5">
      <h3 className="!text-gold-3 font-display text-xl leading-tight sm:text-2xl">{schemeName}</h3>
      {schemeDescription && (
        <p className="mt-2 text-sm leading-relaxed text-gold-3/80">{schemeDescription}</p>
      )}

      <dl className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3">
        <PlanStatRow label={t('home:planMonthly')} value={formatINR(scheme.monthly_amount)} />
        <PlanStatRow
          label={t('home:planTenure')}
          value={t('common:monthTenure', { count: scheme.tenure_months })}
        />
        <PlanStatRow label={t('home:planValue')} value={formatINR(planTotal)} />
      </dl>

      <Button asChild variant="gold" className="mt-4 w-full !min-h-[44px]">
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
  const { data: schemes, isLoading } = useSchemes()

  if (isLoading) {
    return (
      <section className="py-8 sm:py-10">
        <Skeleton className="mx-auto h-64 max-w-[1320px] rounded-2xl sm:h-72" />
      </section>
    )
  }

  if (!schemes?.length) return null

  const primary = schemes[0]

  return (
    <section className="py-8 sm:py-10">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-gold/25 bg-navy shadow-[0_16px_40px_rgba(12,23,48,0.28)]">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />

          <div className="relative p-5 sm:p-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
              {/* Copy */}
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-3 py-1">
                  <PiggyBank className="h-4 w-4 text-gold" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-gold">
                    {t('home:schemeBadge')}
                  </span>
                </div>

                <h2 className="!text-white mt-4 font-display text-[clamp(1.5rem,4vw,2.25rem)] leading-tight">
                  {t('home:schemeTitle')}
                </h2>

                <p className="mt-3 max-w-lg text-sm leading-relaxed text-gold-3/85 sm:text-base">
                  {primary.description || t('home:schemeFallbackDesc')}
                </p>

                <ul className="mt-5 flex flex-col gap-2">
                  {[
                    { icon: Calendar, textKey: 'schemeBenefit1' },
                    { icon: ShieldCheck, textKey: 'schemeBenefit2' },
                    { icon: Sparkles, textKey: 'schemeBenefit3' },
                  ].map(({ icon: Icon, textKey }) => (
                    <li
                      key={textKey}
                      className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gold-3"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-gold" />
                      {t(`home:${textKey}`)}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <Button asChild variant="gold" className="w-full sm:w-auto !min-h-[44px]">
                    <Link to="/scheme">
                      {t('home:schemeCtaPrimary')}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Link
                    to="/scheme"
                    className="text-center text-sm font-semibold text-gold-3 hover:text-white sm:text-left"
                  >
                    {t('home:schemeCtaSecondary')}
                  </Link>
                </div>
              </div>

              {/* Plan cards */}
              <div className="w-full shrink-0 lg:w-[min(100%,380px)]">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gold-3/60">
                  {t('home:availablePlans')}
                </p>
                <div className="flex flex-col gap-4">
                  {schemes.slice(0, 2).map((scheme) => (
                    <SchemePlanCard key={scheme.id} scheme={scheme} />
                  ))}
                </div>
                {schemes.length > 2 && (
                  <p className="mt-3 text-center text-xs text-gold-3/60 lg:text-left">
                    {t('common:morePlansOnSchemePage', { count: schemes.length - 2 })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
