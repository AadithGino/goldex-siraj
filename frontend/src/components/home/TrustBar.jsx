import { useTranslation } from 'react-i18next'
import { Award, ShieldCheck, Truck, Gem } from 'lucide-react'

const TRUST_ITEMS = [
  { icon: Award, titleKey: 'trust.bisTitle', descKey: 'trust.bisDesc' },
  { icon: ShieldCheck, titleKey: 'trust.pricingTitle', descKey: 'trust.pricingDesc' },
  { icon: Truck, titleKey: 'trust.deliveryTitle', descKey: 'trust.deliveryDesc' },
  { icon: Gem, titleKey: 'trust.diamondsTitle', descKey: 'trust.diamondsDesc' },
]

export function TrustBar() {
  const { t } = useTranslation('home')

  return (
    <section className="border-y border-gold/20 bg-ivory-2 py-10 sm:py-12">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_ITEMS.map(({ icon: Icon, titleKey, descKey }) => (
            <div key={titleKey} className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy text-gold-3">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base text-navy">{t(titleKey)}</h3>
                <p className="mt-1 text-sm text-muted">{t(descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
