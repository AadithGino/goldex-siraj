import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, ImagePlus, Scale, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CustomJewellerySection() {
  const { t } = useTranslation('custom')

  return (
    <section className="py-8 sm:py-10">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-gold/25 bg-ivory-2 p-5 shadow-[0_16px_40px_rgba(12,23,48,0.08)] sm:p-8">
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-3 py-1">
              <Sparkles className="h-4 w-4 text-gold" />
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-gold">{t('heroBadge')}</span>
            </div>
            <h2 className="mt-4 font-display text-[clamp(1.5rem,4vw,2.25rem)] leading-tight text-navy">
              {t('heroTitle')}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">{t('heroDesc')}</p>
            <ul className="mt-5 flex flex-col gap-2">
              {[
                { icon: ImagePlus, textKey: 'benefit1' },
                { icon: Scale, textKey: 'benefit2' },
                { icon: Sparkles, textKey: 'benefit3' },
              ].map(({ icon: Icon, textKey }) => (
                <li key={textKey} className="flex items-center gap-2.5 text-sm text-navy">
                  <Icon className="h-4 w-4 shrink-0 text-gold" />
                  {t(textKey)}
                </li>
              ))}
            </ul>
            <Button asChild variant="gold" className="mt-6 w-full sm:w-auto">
              <Link to="/custom-jewellery">
                {t('cta')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
