import { Link } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { BannerPicture } from '@/components/banners/BannerPicture'
import { useBanners } from '@/hooks/useBanners'
import { getBannerSpec } from '@/lib/bannerSpecs'
import { cn } from '@/lib/utils'

/**
 * Renders all active banners for a position in a grid whose tile aspect ratio
 * comes straight from BANNER_SPECS — so what the client uploads always fits.
 * Returns null when there are no banners, so empty sections never show.
 *
 * `full` = edge-to-edge (no max-width container), used for hero-like strips.
 */
export function BannerRow({ position, title, subtitle, full = false }) {
  const { data: banners, isLoading } = useBanners(position)
  const spec = getBannerSpec(position)

  if (isLoading) {
    return (
      <div className={full ? 'w-full' : 'mx-auto max-w-[1320px] px-4 sm:px-6'}>
        <Skeleton className={cn('w-full rounded-2xl', spec.aspectClass)} />
      </div>
    )
  }

  if (!banners?.length) return null

  const Tile = ({ banner }) => {
    const inner = (
      <div className={cn('relative w-full overflow-hidden', !full && 'rounded-2xl', spec.aspectClass)}>
        <BannerPicture
          banner={banner}
          imgClassName="transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
      </div>
    )
    return banner.cta_link ? (
      <Link to={banner.cta_link} className="group block">
        {inner}
      </Link>
    ) : (
      <div className="group block">{inner}</div>
    )
  }

  // Edge-to-edge single banner (strip / mid-page wide)
  if (full && spec.columns === 1) {
    return (
      <section className="w-full">
        {banners.slice(0, 1).map((b) => (
          <Tile key={b.id} banner={b} />
        ))}
      </section>
    )
  }

  return (
    <section className="py-8 sm:py-10">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        {(title || subtitle) && (
          <div className="mb-5 text-center">
            {title && <h2 className="font-display text-[clamp(22px,2.6vw,34px)] text-navy">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
            <div className="gold-rule mx-auto mt-3" />
          </div>
        )}
        <div className={cn('grid gap-3 sm:gap-4', spec.gridClass)}>
          {banners.map((banner) => (
            <Tile key={banner.id} banner={banner} />
          ))}
        </div>
      </div>
    </section>
  )
}
