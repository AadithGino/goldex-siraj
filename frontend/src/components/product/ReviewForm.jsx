import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { useMyReview, useSubmitReview } from '@/hooks/useReviews'
import { ReviewStatusBadge } from '@/components/product/ReviewList'
import { Skeleton } from '@/components/ui/skeleton'

export function ReviewForm({ productId, embedded = false }) {
  const { t } = useTranslation(['product', 'common', 'errors'])
  const navigate = useNavigate()
  const { isAuthenticated } = useCustomerAuth()
  const { data: myReview, isLoading } = useMyReview(productId)
  const submitReview = useSubmitReview()
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  if (isLoading) return <Skeleton className="h-24 w-full" />

  if (myReview) {
    return (
      <div className="rounded-2xl bg-ivory-3 p-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-navy">{t('common:yourReview')}</span>
          <ReviewStatusBadge status={myReview.status} />
        </div>
        <p className="mt-2 text-muted">
          {myReview.status === 'pending'
            ? t('common:reviewPendingThanks')
            : myReview.status === 'approved'
              ? t('common:reviewPublished')
              : t('common:reviewRejected')}
        </p>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isAuthenticated) {
      toast.info(t('common:signInToReview'))
      navigate('/login')
      return
    }
    try {
      await submitReview.mutateAsync({ product_id: productId, rating, title, body })
      toast.success(t('common:reviewSubmitted'))
      setTitle('')
      setBody('')
    } catch (err) {
      toast.error(err.message || t('errors:product.submitReviewFailed'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!embedded && <p className="text-sm font-medium text-navy">{t('product:writeReview')}</p>}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {t('product:yourRating')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                n <= rating ? 'bg-navy text-gold-3' : 'bg-ivory-2 text-muted'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('product:reviewTitlePlaceholder')}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t('product:reviewBodyPlaceholder')}
        rows={3}
        required
        className="w-full rounded-2xl border border-gold/20 bg-ivory-2 px-4 py-3 text-sm"
      />
      <Button type="submit" disabled={submitReview.isPending}>
        {submitReview.isPending ? t('common:submitting') : t('product:submitReview')}
      </Button>
    </form>
  )
}
