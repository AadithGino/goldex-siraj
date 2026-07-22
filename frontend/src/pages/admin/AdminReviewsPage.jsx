import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAdminReviews, useModerateReview } from '@/hooks/useAdminReviews'
import { cn } from '@/lib/utils'
import { Star } from 'lucide-react'

const FILTERS = ['all', 'pending', 'approved', 'rejected']

export function AdminReviewsPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || 'pending'
  const { data: reviews } = useAdminReviews(status)
  const moderate = useModerateReview()

  const handleModerate = async (id, newStatus) => {
    try {
      await moderate.mutateAsync({ id, status: newStatus })
      toast.success(`Review ${newStatus}`)
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div>
      <AdminPageHeader title="Reviews" description="Moderate customer product reviews." />
      <div className="mb-6 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setParams({ status: f })}
            className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize',
              status === f ? 'border-navy bg-navy text-gold-3' : 'border-gold/30 text-navy')}>{f}</button>
        ))}
      </div>
      <div className="space-y-3">
        {reviews?.map((r) => (
          <div key={r.id} className="rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/product/${r.products?.slug}`} className="font-medium text-navy hover:text-gold">{r.products?.name}</Link>
              <Badge variant={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'destructive' : 'muted'}>{r.status}</Badge>
              <div className="flex">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-3 w-3 fill-gold text-gold" />)}</div>
            </div>
            <p className="mt-1 text-xs text-muted">{r.customers?.full_name} · {r.customers?.phone}</p>
            {r.title && <p className="mt-2 font-medium text-navy">{r.title}</p>}
            {r.body && <p className="mt-1 text-sm text-muted">{r.body}</p>}
            {r.status === 'pending' && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => handleModerate(r.id, 'approved')}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => handleModerate(r.id, 'rejected')}>Reject</Button>
              </div>
            )}
          </div>
        ))}
        {!reviews?.length && <p className="text-sm text-muted">No reviews in this filter.</p>}
      </div>
    </div>
  )
}
