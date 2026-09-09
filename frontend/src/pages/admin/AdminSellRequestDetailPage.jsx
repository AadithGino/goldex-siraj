import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ChevronLeft } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminSellRequest, useAdminSellRequestAction } from '@/hooks/useAdminSellRequests'
import { useGoldBuybackRate } from '@/hooks/useGoldRate'
import { formatAED } from '@/lib/pricing'

const STATUS_VARIANT = {
  submitted: 'gold',
  needs_info: 'navy',
  offered: 'navy',
  accepted: 'success',
  declined: 'destructive',
  cancelled: 'muted',
  completed: 'success',
}

function estimateAmount(weight, rate) {
  const w = Number(weight)
  const r = Number(rate)
  if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(r) || r <= 0) return null
  return Math.round((w * r + Number.EPSILON) * 100) / 100
}

function mapsUrl(lat, lng) {
  if (lat == null || lng == null || lat === '') return null
  return `https://maps.google.com/?q=${encodeURIComponent(`${lat},${lng}`)}`
}

function ReviewForm({ request }) {
  const action = useAdminSellRequestAction()
  const { data: rates } = useGoldBuybackRate()
  const liveRate = rates?.find((row) => row.purity === request.purity)?.rate_per_gram
  const [form, setForm] = useState({
    net_weight_grams: String(request.net_weight_grams || ''),
    rate_per_gram: '',
    admin_notes: '',
    valid_days: '7',
    info_message: '',
    decline_reason: '',
  })
  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))
  const rate = form.rate_per_gram === '' ? liveRate : Number(form.rate_per_gram)
  const preview = estimateAmount(form.net_weight_grams, rate)

  const sendOffer = async () => {
    try {
      await action.mutateAsync({
        id: request.id,
        action: 'offer',
        body: {
          net_weight_grams: Number(form.net_weight_grams),
          rate_per_gram: form.rate_per_gram === '' ? undefined : Number(form.rate_per_gram),
          admin_notes: form.admin_notes,
          valid_days: Number(form.valid_days) || 7,
        },
      })
      toast.success('Offer sent to customer')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const requestInfo = async () => {
    if (form.info_message.trim().length < 4) {
      toast.error('Write a short note asking for more details')
      return
    }
    try {
      await action.mutateAsync({
        id: request.id,
        action: 'request-info',
        body: { message: form.info_message.trim() },
      })
      toast.success('Asked customer for more details')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const decline = async () => {
    try {
      await action.mutateAsync({
        id: request.id,
        action: 'decline',
        body: { reason: form.decline_reason },
      })
      toast.success('Request declined')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-3 rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-5">
      <p className="text-sm font-semibold text-navy">Review &amp; respond</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-navy">Inspected net weight (g)</label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={form.net_weight_grams}
            onChange={(e) => update({ net_weight_grams: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-navy">
            Rate per gram (AED){liveRate ? ` · live ${formatAED(liveRate)}` : ''}
          </label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={form.rate_per_gram}
            onChange={(e) => update({ rate_per_gram: e.target.value })}
            placeholder={liveRate ? String(liveRate) : 'Set sell-in rate first'}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-navy">Offer valid (days)</label>
          <Input
            type="number"
            min="1"
            max="90"
            value={form.valid_days}
            onChange={(e) => update({ valid_days: e.target.value })}
          />
        </div>
      </div>
      {preview != null && (
        <p className="rounded-2xl bg-ivory px-3 py-2 text-sm font-semibold text-navy">
          Offer preview {formatAED(preview)}
        </p>
      )}
      {!liveRate && form.rate_per_gram === '' && (
        <p className="text-xs text-[#b3261e]">
          No live sell-in rate for {String(request.purity).toUpperCase()}. Enter a rate or set one in Gold rates.
        </p>
      )}
      <Input
        value={form.admin_notes}
        onChange={(e) => update({ admin_notes: e.target.value })}
        placeholder="Note to customer (inspection, stones deducted…)"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={action.isPending || preview == null} onClick={sendOffer}>Send offer</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-sm"
          value={form.info_message}
          onChange={(e) => update({ info_message: e.target.value })}
          placeholder="Ask for more photos or details"
        />
        <Button size="sm" variant="outline" disabled={action.isPending} onClick={requestInfo}>Request more details</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          value={form.decline_reason}
          onChange={(e) => update({ decline_reason: e.target.value })}
          placeholder="Decline reason"
        />
        <Button size="sm" variant="outline" disabled={action.isPending} onClick={decline}>Decline</Button>
      </div>
    </div>
  )
}

export function AdminSellRequestDetailPage() {
  const { id } = useParams()
  const { data: request, isLoading, isError } = useAdminSellRequest(id)
  const action = useAdminSellRequestAction()

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-[28px]" />
      </div>
    )
  }

  if (isError || !request) {
    return (
      <div className="text-center text-muted">
        Request not found.
        <Button asChild className="mt-4 block" variant="outline" size="sm">
          <Link to="/admin/sell-requests">Back to list</Link>
        </Button>
      </div>
    )
  }

  const customer = request.customer || {}
  const address = request.pickup_address || {}
  const offer = request.offer
  const map = mapsUrl(address.latitude, address.longitude)

  const complete = async () => {
    try {
      await action.mutateAsync({ id: request.id, action: 'complete', body: { note: '' } })
      toast.success('Marked complete')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="max-w-4xl">
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 h-8">
        <Link to="/admin/sell-requests">
          <ChevronLeft className="h-4 w-4" />
          Sell jewellery
        </Link>
      </Button>

      <AdminPageHeader
        title={request.request_number}
        description={`${customer.full_name || customer.fullName || 'Customer'} · ${customer.phone || '—'} · ${format(new Date(request.created_at), 'dd MMM yyyy HH:mm')}`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_VARIANT[request.status] || 'muted'}>
          {String(request.status || '').replace('_', ' ')}
        </Badge>
        <Badge variant="outline">{request.jewellery_type}</Badge>
        <Badge variant="outline">{String(request.purity || '').toUpperCase()}</Badge>
      </div>

      <div className="space-y-4">
        <section className="rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-5">
          <p className="text-sm text-navy">
            Declared {request.net_weight_grams} g
            {request.indicative?.amount != null ? ` · indicative ${formatAED(request.indicative.amount)}` : ''}
          </p>
          {request.notes && <p className="mt-3 text-sm leading-relaxed text-muted">{request.notes}</p>}
          {request.images?.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto">
              {request.images.map((image, index) => (
                <a key={image.key || index} href={image.url || image.key} target="_blank" rel="noreferrer">
                  <img src={image.url || image.key} alt="" className="h-28 w-28 rounded-xl border border-gold/20 object-cover bg-ivory" />
                </a>
              ))}
            </div>
          )}
          {request.invoice?.key && (
            <a
              href={request.invoice.url || request.invoice.key}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-xs font-semibold text-gold hover:underline"
            >
              View invoice / bill
            </a>
          )}
        </section>

        <section className="rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-5">
          <p className="text-xs font-black uppercase tracking-[.12em] text-gold">Pickup</p>
          <p className="mt-2 text-sm text-navy">
            {[address.recipient_name, address.phone, address.line1, address.line2, address.city, address.state, address.pincode]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {map && (
            <a href={map} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-gold hover:underline">
              Open pickup pin in Google Maps
            </a>
          )}
        </section>

        {request.messages?.length > 0 && (
          <section className="rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-5">
            <p className="text-xs font-black uppercase tracking-[.12em] text-gold">Messages</p>
            <div className="mt-3 space-y-2">
              {request.messages.map((message, index) => (
                <p key={`${message.created_at}-${index}`} className="text-sm text-navy">
                  <span className="text-xs uppercase tracking-wide text-gold">{message.author}: </span>
                  {message.body}
                </p>
              ))}
            </div>
          </section>
        )}

        {offer && (
          <section className="rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-5">
            <p className="font-semibold text-navy">Offered {formatAED(offer.amount)}</p>
            <p className="mt-1 text-xs text-muted">
              {offer.net_weight_grams} g · {formatAED(offer.rate_per_gram)}/g
            </p>
            {offer.notes && <p className="mt-2 text-sm text-navy">{offer.notes}</p>}
            {offer.valid_until && (
              <p className="mt-1 text-xs text-muted">Valid until {format(new Date(offer.valid_until), 'dd MMM yyyy')}</p>
            )}
          </section>
        )}

        {request.decline_reason && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#b3261e]">
            Decline reason: {request.decline_reason}
          </p>
        )}

        {['submitted', 'needs_info', 'offered'].includes(request.status) && <ReviewForm request={request} />}

        {request.status === 'accepted' && (
          <Button disabled={action.isPending} onClick={complete}>Mark completed</Button>
        )}
      </div>
    </div>
  )
}
