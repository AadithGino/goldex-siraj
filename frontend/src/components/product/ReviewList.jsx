import { useTranslation } from 'react-i18next'
import { Star } from 'lucide-react'
import { format } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useProductReviews } from '@/hooks/useReviews'

export function ReviewList({ productId, embedded = false }) {
  const { t } = useTranslation(['product', 'common'])
  const { data: reviews, isLoading } = useProductReviews(productId)

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (!reviews?.length) {
    return (
      <div
        className={
          embedded
            ? 'flex min-h-[220px] flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-gold/25 bg-ivory px-6 py-10 text-center sm:min-h-[280px] sm:py-12'
            : 'rounded-2xl border border-dashed border-gold/25 bg-ivory-2 px-6 py-12 text-center'
        }
      >
        <Star className="h-9 w-9 text-gold/35" />
        <p className="mt-4 font-display text-xl text-navy">{t('product:noReviews')}</p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{t('product:noReviewsDesc')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <article
          key={review.id}
          className="rounded-2xl border border-gold/15 bg-ivory p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < review.rating ? 'fill-gold text-gold' : 'text-ivory-3'}`}
                />
              ))}
            </div>
            <span className="text-sm font-semibold text-navy">
              {review.customers?.full_name || t('common:customerFallback')}
            </span>
            <span className="text-xs text-muted">
              {format(new Date(review.created_at), 'dd MMM yyyy')}
            </span>
          </div>
          {review.title && <p className="mt-3 font-medium text-navy">{review.title}</p>}
          {(review.comment || review.body) && (
            <p className="mt-2 text-sm leading-relaxed text-muted">{review.comment || review.body}</p>
          )}
        </article>
      ))}
    </div>
  )
}

export function ReviewStatusBadge({ status }) {
  const variants = { pending: 'muted', approved: 'success', rejected: 'destructive' }
  return <Badge variant={variants[status] || 'muted'}>{status}</Badge>
}
