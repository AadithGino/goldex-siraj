import { useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

function toEmbedUrl(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`
    if (host.endsWith('youtube.com')) {
      const id = u.searchParams.get('v') || u.pathname.split('/').pop()
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (host.endsWith('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop()
      return id ? `https://player.vimeo.com/video/${id}` : null
    }
  } catch {
    return null
  }
  return null
}

function isDirectVideo(url) {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url || '')
}

export function ProductImageGallery({
  images = [],
  videoUrl = null,
  productName = 'Product',
  showDisclaimer = true,
}) {
  const { t } = useTranslation('product')
  const sortedImages = useMemo(
    () =>
      [...images].sort(
        (a, b) =>
          Number(b.is_primary) - Number(a.is_primary) ||
          (a.display_order ?? 0) - (b.display_order ?? 0)
      ),
    [images]
  )

  const media = useMemo(() => {
    const list = sortedImages.map((img) => ({ kind: 'image', url: img.url, alt: img.alt }))
    if (videoUrl) {
      const embed = toEmbedUrl(videoUrl)
      list.unshift({
        kind: 'video',
        direct: isDirectVideo(videoUrl),
        url: videoUrl,
        embed,
        poster: sortedImages[0]?.url || null,
      })
    }
    return list
  }, [sortedImages, videoUrl])

  const [activeIndex, setActiveIndex] = useState(0)
  const thumbRef = useRef(null)
  const active = media[activeIndex] || media[0]

  const scrollThumbs = (direction) => {
    thumbRef.current?.scrollBy({ top: direction * 76, behavior: 'smooth' })
  }

  if (!media.length) {
    return (
      <div className="flex h-[min(320px,45vh)] items-center justify-center border border-line bg-white text-sm text-muted sm:aspect-[4/5] sm:h-auto">
        {t('noImageAvailable')}
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-3 sm:gap-4">
        {media.length > 1 && (
          <div className="hidden shrink-0 flex-col items-center sm:flex">
            <button
              type="button"
              onClick={() => scrollThumbs(-1)}
              className="mb-1 grid h-7 w-7 place-items-center rounded border border-line text-muted transition-colors hover:border-gold/40 hover:text-navy"
              aria-label={t('thumbScrollUpAria')}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <div
              ref={thumbRef}
              className="flex max-h-[min(420px,52vh)] w-[72px] flex-col gap-2 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {media.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className={cn(
                    'relative h-[68px] w-full shrink-0 overflow-hidden border-2 bg-white transition-all',
                    i === activeIndex
                      ? 'border-gold shadow-[0_0_0_1px_rgba(184,144,47,0.35)]'
                      : 'border-line opacity-75 hover:border-gold/30 hover:opacity-100'
                  )}
                >
                  <img
                    src={m.kind === 'video' ? m.poster || m.url : m.url}
                    alt=""
                    className="h-full w-full object-contain p-1"
                  />
                  {m.kind === 'video' && (
                    <span className="absolute inset-0 grid place-items-center bg-black/25">
                      <Play className="h-4 w-4 fill-white text-white" />
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => scrollThumbs(1)}
              className="mt-1 grid h-7 w-7 place-items-center rounded border border-line text-muted transition-colors hover:border-gold/40 hover:text-navy"
              aria-label={t('thumbScrollDownAria')}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="relative aspect-square overflow-hidden border border-line bg-white">
            {active?.kind === 'video' ? (
              active.direct ? (
                <video
                  src={active.url}
                  poster={active.poster || undefined}
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                />
              ) : active.embed ? (
                <iframe
                  src={active.embed}
                  title={`${productName} video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : (
                <a
                  href={active.url}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-full w-full place-items-center text-sm text-navy underline"
                >
                  {t('watchVideo')}
                </a>
              )
            ) : (
              <img
                src={active?.url}
                alt={active?.alt || productName}
                className="h-full w-full object-contain p-4 sm:p-6"
              />
            )}
          </div>

          {media.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:hidden">
              {media.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className={cn(
                    'relative h-14 w-14 shrink-0 overflow-hidden border-2 bg-white',
                    i === activeIndex ? 'border-gold' : 'border-line opacity-80'
                  )}
                >
                  <img
                    src={m.kind === 'video' ? m.poster || m.url : m.url}
                    alt=""
                    className="h-full w-full object-contain p-0.5"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showDisclaimer && (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {t('imageDisclaimer')}
        </p>
      )}
    </div>
  )
}
