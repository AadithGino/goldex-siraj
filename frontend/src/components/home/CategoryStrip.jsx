import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useCategories } from '@/hooks/useCategories'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'

/** Shop By Category — square cards with label below, matching the reference. */
export function CategoryStrip() {
  const { t } = useTranslation(['home', 'common'])
  const lang = useContentLang()
  const { data: categories, isLoading } = useCategories()
  const topLevel = categories?.filter((c) => !c.parent_id) || []

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6">
        <Skeleton className="mb-6 h-9 w-56" />
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!topLevel.length) return null

  return (
    <section className="py-10 sm:py-12">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="font-display text-[clamp(24px,2.8vw,38px)] text-navy">{t('home:shopByCategory')}</h2>
          <Link
            to="/search"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-navy hover:text-gold"
          >
            {t('common:viewAll')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {topLevel.slice(0, 6).map((category) => {
            const name = pickField(category, 'name', lang)
            return (
            <Link key={category.id} to={`/category/${category.slug}`} className="group block">
              <div className="aspect-square overflow-hidden rounded-2xl border border-line bg-ivory-3 transition-all group-hover:border-navy group-hover:shadow-[0_10px_24px_rgba(20,33,61,.12)]">
                {category.image_url ? (
                  <img
                    src={category.image_url}
                    alt={name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-display text-3xl text-gold">
                    {name.charAt(0)}
                  </div>
                )}
              </div>
              <p className="mt-3 text-center text-sm font-medium text-navy group-hover:text-gold">
                {name}
              </p>
            </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
