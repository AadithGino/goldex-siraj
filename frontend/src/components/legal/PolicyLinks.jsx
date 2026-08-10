import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePublishedCmsPages } from '@/hooks/useCmsPages'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'
import { cn } from '@/lib/utils'

/** Policy links reflect published CMS pages (footer, checkout, login). */
export function PolicyLinks({ className, linkClassName, variant = 'inline' }) {
  const { t } = useTranslation('common')
  const lang = useContentLang()
  const { data, isLoading, isError } = usePublishedCmsPages({ page: 1, limit: 50 })

  if (isLoading || isError) return null

  const pages = (data?.data || [])
    .map((page) => ({
      slug: page.slug,
      label: pickField(page, 'title', lang),
    }))
    .filter((page) => page.slug && page.label)

  if (!pages.length) return null

  if (variant === 'stacked') {
    return (
      <nav className={className} aria-label={t('policiesNav')}>
        <ul className="space-y-2 text-sm">
          {pages.map((page) => (
            <li key={page.slug}>
              <Link
                to={`/page/${page.slug}`}
                className={cn('hover:text-gold hover:underline', linkClassName)}
              >
                {page.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    )
  }

  return (
    <nav className={className} aria-label={t('policiesNav')}>
      <ul className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted">
        {pages.map((page, index) => (
          <li key={page.slug} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">·</span> : null}
            <Link
              to={`/page/${page.slug}`}
              className={cn('underline-offset-2 hover:text-navy hover:underline', linkClassName)}
            >
              {page.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
