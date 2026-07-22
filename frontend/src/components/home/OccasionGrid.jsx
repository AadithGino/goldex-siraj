import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { OCCASIONS } from '@/lib/constants'
import { useProducts } from '@/hooks/useProducts'
import { Skeleton } from '@/components/ui/skeleton'

const OCCASION_FALLBACK_IMAGES = {
  bridal:
    'https://s7ap1.scene7.com/is/image/malabargroup/mgdsite/products/permanent/india/gold%20ornaments/finger%20ring/FR-334814/FRDZL55825-0001/FRDZL55825-0001-2.JPG?fmt=webp-alpha&wid=600&hei=500',
  daily:
    'https://s7ap1.scene7.com/is/image/malabargroup/mgdsite/products/permanent/india/gold%20ornaments/finger%20ring/FR-334814/FRDZL55825-0001/FRDZL55825-0001-1.JPG?fmt=webp-alpha&wid=600&hei=500',
  gift:
    'https://s7ap1.scene7.com/is/image/malabargroup/mgdsite/products/permanent/india/gold%20ornaments/pendant/PD-030238/PDDZL29722-0001/PDDZL29722-0001-1.Jpg?fmt=webp-alpha&wid=600&hei=500',
  festive:
    'https://s7ap1.scene7.com/is/image/malabargroup/mgdsite/products/permanent/india/gold%20ornaments/nose%20pin/NP-040310/NPDZL10350-0001/NPDZL10350-0001-1.Jpg?fmt=webp-alpha&wid=600&hei=500',
  office:
    'https://s7ap1.scene7.com/is/image/malabargroup/mgdsite/products/permanent/india/gold%20ornaments/nose%20pin/NP-320603/NPDZL40429-0001/NPDZL40429-0001-2.jpg?fmt=webp-alpha&wid=600&hei=500',
}

function OccasionCard({ occasion }) {
  const { t } = useTranslation(['home', 'common'])
  const { data: products, isLoading } = useProducts({ occasion: occasion.key })
  const preview = products?.[0]
  const image = preview?.primary_image || OCCASION_FALLBACK_IMAGES[occasion.key]

  return (
    <Link
      to={`/search?occasion=${occasion.key}`}
      className="group relative overflow-hidden rounded-[28px] border border-gold/20 bg-ivory-2 shadow-[0_14px_34px_rgba(7,21,37,.09)] transition-all hover:-translate-y-1 hover:border-gold/40"
    >
      {isLoading ? (
        <div className="flex h-44 items-center justify-center bg-ivory-3 sm:h-52">
          <Skeleton className="h-full w-full" />
        </div>
      ) : (
        <img
          src={image}
          alt={t(`common:occasion.${occasion.key}`)}
          className="h-44 w-full object-cover transition-transform group-hover:scale-105 sm:h-52"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-navy/80 via-navy/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{occasion.key}</p>
        <h3 className="mt-1 font-display text-xl text-gold-3">{t(`common:occasion.${occasion.key}`)}</h3>
        <p className="mt-1 text-xs text-gold-3/80">
          {t('common:pieceCount', { count: products?.length || 0 })}
        </p>
      </div>
    </Link>
  )
}

export function OccasionGrid() {
  const { t } = useTranslation('home')

  return (
    <section className="py-10 sm:py-12">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('occasionsEyebrow')}</p>
          <h2 className="font-display text-[clamp(28px,3.3vw,46px)] text-navy">{t('shopByOccasion')}</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {OCCASIONS.slice(0, 3).map((occasion) => (
            <OccasionCard key={occasion.key} occasion={occasion} />
          ))}
        </div>
      </div>
    </section>
  )
}
