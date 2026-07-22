import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { BannerPicture } from '@/components/banners/BannerPicture'
import { useBanners } from '@/hooks/useBanners'
import { getBannerSpec } from '@/lib/bannerSpecs'
import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
} from '@/components/ui/carousel'

const AUTOPLAY_MS = 5000

/**
 * Full-bleed hero carousel. Copy and CTA live inside the uploaded images.
 * Desktop and mobile use separate creatives via BannerPicture.
 */
export function HeroBanner() {
  const { t } = useTranslation('home')
  const { data: banners, isLoading } = useBanners('hero')
  const heroSpec = getBannerSpec('hero')
  const [api, setApi] = useState(null)
  const pausedRef = useRef(false)

  useEffect(() => {
    if (!api || banners?.length <= 1) return

    const tick = () => {
      if (pausedRef.current) return
      api.scrollNext()
    }

    const interval = window.setInterval(tick, AUTOPLAY_MS)
    return () => window.clearInterval(interval)
  }, [api, banners?.length])

  if (isLoading) {
    return <Skeleton className="h-[clamp(220px,34vw,520px)] w-full" />
  }

  if (!banners?.length) {
    return (
      <Link
        to="/search"
        className="block w-full bg-navy px-6 py-20 text-center sm:py-28"
      >
        <span className="font-display text-[clamp(24px,3vw,42px)] text-gold-3">
          {t('heroFallbackCta')}
        </span>
      </Link>
    )
  }

  const Slide = ({ banner }) => {
    const content = (
      <div className={`relative w-full overflow-hidden ${heroSpec.aspectClass}`}>
        <BannerPicture banner={banner} />
      </div>
    )

    if (banner.cta_link) {
      return (
        <Link to={banner.cta_link} className="block">
          {content}
        </Link>
      )
    }

    return content
  }

  if (banners.length === 1) {
    return (
      <section className="w-full">
        <Slide banner={banners[0]} />
      </section>
    )
  }

  return (
    <section
      className="relative w-full"
      onMouseEnter={() => {
        pausedRef.current = true
      }}
      onMouseLeave={() => {
        pausedRef.current = false
      }}
    >
      <Carousel className="w-full" opts={{ loop: true }} setApi={setApi}>
        <CarouselContent className="-ml-0">
          {banners.map((banner) => (
            <CarouselItem key={banner.id} className="pl-0">
              <Slide banner={banner} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselDots />
      </Carousel>
    </section>
  )
}
