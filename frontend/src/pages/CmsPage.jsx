import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useCmsPage } from '@/hooks/useCmsPages'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'
import { sanitizeCmsHtml } from '@/lib/htmlSanitize'

export function CmsPage() {
  const { t } = useTranslation(['account', 'common'])
  const lang = useContentLang()
  const { slug } = useParams()
  const { data: page, isLoading, error } = useCmsPage(slug)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    )
  }

  if (error || !page) {
    return (
      <div className="mx-auto max-w-[1320px] px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-3xl text-navy">{t('account:cmsNotFound')}</h1>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/">{t('common:backToHome')}</Link>
        </Button>
      </div>
    )
  }

  const html = sanitizeCmsHtml(pickField(page, 'content', lang) || '')

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6">
      <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('common:information')}</p>
      <h1 className="mt-2 font-display text-[clamp(28px,3.3vw,46px)] text-navy">{pickField(page, 'title', lang)}</h1>
      <div
        className="prose prose-sm mt-8 max-w-none text-muted prose-headings:font-display prose-headings:text-navy prose-h2:mt-8 prose-h2:text-xl prose-h3:mt-6 prose-h3:text-base prose-ul:my-3 prose-li:my-1 [&_a]:text-gold"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
