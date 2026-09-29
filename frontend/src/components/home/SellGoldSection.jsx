import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Coins, ImagePlus, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HomeSplitPromoSection } from '@/components/home/HomeSplitPromoSection'

export function SellGoldSection() {
  const { t } = useTranslation('sell')

  return (
    <HomeSplitPromoSection bannerPosition="sell_jewellery" imageSide="left" tone="dark">
      <div className="inline-flex items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-3 py-1">
        <Coins className="h-4 w-4 text-gold" />
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-gold">{t('heroBadge')}</span>
      </div>
      <h2 className="mt-4 font-display text-[clamp(1.5rem,4vw,2.35rem)] leading-tight text-ivory">
        {t('heroTitle')}
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-gold-3/85 sm:text-base">{t('heroDesc')}</p>
      <ul className="mt-5 flex flex-col gap-2.5">
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
      <Button asChild variant="gold" className="mt-7 w-full sm:w-auto">
        <Link to="/sell-jewellery">
          {t('cta')}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </HomeSplitPromoSection>
  )
}
