import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Coins, ImagePlus, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SellGoldSection() {
  const { t } = useTranslation('sell')

  return (
    <section className="py-8 sm:py-10">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-gold/25 bg-navy p-5 text-gold-3 shadow-[0_16px_40px_rgba(12,23,48,0.18)] sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-3 py-1">
              <Coins className="h-4 w-4 text-gold" />
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-gold">{t('heroBadge')}</span>
            </div>
            <h2 className="mt-4 font-display text-[clamp(1.5rem,4vw,2.25rem)] leading-tight text-ivory">
              {t('heroTitle')}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gold-3/80 sm:text-base">{t('heroDesc')}</p>
            <ul className="mt-5 flex flex-col gap-2">
              {[
                { icon: ImagePlus, textKey: 'benefit1' },
                { icon: Coins, textKey: 'benefit2' },
                { icon: MapPin, textKey: 'benefit3' },
              ].map(({ icon: Icon, textKey }) => (
                <li key={textKey} className="flex items-center gap-2.5 text-sm text-gold-3">
                  <Icon className="h-4 w-4 shrink-0 text-gold" />
                  {t(textKey)}
                </li>
              ))}
            </ul>
            <Button asChild variant="gold" className="mt-6 w-full sm:w-auto">
              <Link to="/sell-jewellery">
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
