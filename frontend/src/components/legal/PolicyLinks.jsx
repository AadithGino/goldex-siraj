import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { POLICY_PAGES, getPolicyLabel } from '@/lib/policyPages'
import { useContentLang } from '@/hooks/useContentLang'
import { cn } from '@/lib/utils'

/** Policy links use known slugs + localized labels — no capped CMS list. */
export function PolicyLinks({ className, linkClassName, variant = 'inline' }) {
  const { t } = useTranslation('common')
  const lang = useContentLang()

  const pages = POLICY_PAGES.map((policy) => ({
    slug: policy.slug,
    label: getPolicyLabel(policy, lang),
  }))

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
