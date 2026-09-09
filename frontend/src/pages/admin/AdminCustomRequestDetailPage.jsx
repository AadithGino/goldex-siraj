import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ChevronLeft } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LabeledSelect } from '@/components/ui/labeled-select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminCustomRequest, useAdminCustomRequestAction } from '@/hooks/useAdminCustomRequests'
import { useGoldRate } from '@/hooks/useGoldRate'
import { useTaxSettings } from '@/hooks/useAdminSettings'
import { previewCustomQuote } from '@/lib/customQuote'
import { formatAED } from '@/lib/pricing'

const STATUS_VARIANT = {
  submitted: 'gold',
  quoted: 'navy',
  accepted: 'success',
  declined: 'destructive',
  cancelled: 'muted',
  completed: 'success',
}

function QuotePreview({ request, form, rates, tax }) {
  const rate = rates?.find((row) => row.purity === request.purity)?.rate_per_gram
  const preview = previewCustomQuote({
    weight: request.gold_weight_grams,
    rate,
    makingType: form.making_charge_type,
    makingValue: form.making_charge_value,
    wastagePercent: form.wastage_percent,
    stoneCharge: form.stone_charge,
    vatPercent: tax?.vat_percent,
    taxMode: tax?.prices_include_vat ? 'inclusive' : 'exclusive',
  })
  if (!rate) return <p className="text-xs text-[#b3261e]">No live {String(request.purity).toUpperCase()} gold rate.</p>
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-2xl bg-ivory p-3 text-xs text-navy">
      <dt>Gold @ {formatAED(rate)}/g</dt><dd className="text-right">{formatAED(preview.goldValue)}</dd>
      <dt>Wastage</dt><dd className="text-right">{formatAED(preview.wastageAmount)}</dd>
      <dt>Making</dt><dd className="text-right">{formatAED(preview.makingCharge)}</dd>
      <dt>Stones</dt><dd className="text-right">{formatAED(preview.stone)}</dd>
      <dt>VAT</dt><dd className="text-right">{formatAED(preview.vatAmount)}</dd>
      <dt className="font-semibold">Estimated total</dt>
      <dd className="text-right font-semibold text-gold">{formatAED(preview.total)}</dd>
    </dl>
  )
}

function QuoteForm({ request }) {
  const { data: rates } = useGoldRate()
  const { data: tax } = useTaxSettings()
  const action = useAdminCustomRequestAction()
  const [form, setForm] = useState({
    making_charge_type: 'percent',
    making_charge_value: '12',
    wastage_percent: '4',
    stone_charge: '0',
    admin_notes: '',
    valid_days: '7',
    decline_reason: '',
  })
  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const sendQuote = async () => {
    try {
      await action.mutateAsync({
        id: request.id,
        action: 'quote',
        body: {
          making_charge_type: form.making_charge_type,
          making_charge_value: Number(form.making_charge_value),
          wastage_percent: Number(form.wastage_percent),
          stone_charge: Number(form.stone_charge) || 0,
          admin_notes: form.admin_notes,
          valid_days: Number(form.valid_days) || 7,
        },
      })
      toast.success('Quote sent to customer')
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
      <p className="text-sm font-semibold text-navy">Send quote</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <LabeledSelect
          label="Making charge type"
          value={form.making_charge_type}
          onValueChange={(making_charge_type) => update({ making_charge_type })}
          options={[
            { value: 'percent', label: 'Percent of gold value' },
            { value: 'flat', label: 'Flat AED' },
          ]}
        />
        <div>
          <label className="mb-2 block text-sm font-medium text-navy">
            {form.making_charge_type === 'flat' ? 'Making charge (AED)' : 'Making charge %'}
          </label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.making_charge_value}
            onChange={(e) => update({ making_charge_value: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-navy">Wastage %</label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={form.wastage_percent}
            onChange={(e) => update({ wastage_percent: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-navy">Stone charge (AED)</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.stone_charge}
            onChange={(e) => update({ stone_charge: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-navy">Quote valid (days)</label>
          <Input
            type="number"
            min="1"
            max="90"
            value={form.valid_days}
            onChange={(e) => update({ valid_days: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-navy">Note to customer</label>
        <Input
          value={form.admin_notes}
          onChange={(e) => update({ admin_notes: e.target.value })}
          placeholder="Setting, finish, timeline…"
        />
      </div>
      <QuotePreview request={request} form={form} rates={rates} tax={tax} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={action.isPending} onClick={sendQuote}>Send quote</Button>
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

export function AdminCustomRequestDetailPage() {
  const { id } = useParams()
  const { data: request, isLoading, isError } = useAdminCustomRequest(id)
  const action = useAdminCustomRequestAction()

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
          <Link to="/admin/custom-requests">Back to list</Link>
        </Button>
      </div>
    )
  }

  const customer = request.customer || {}
  const quote = request.quote

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
        <Link to="/admin/custom-requests">
          <ChevronLeft className="h-4 w-4" />
          Custom jewellery
        </Link>
      </Button>

      <AdminPageHeader
        title={request.request_number}
        description={`${customer.full_name || customer.fullName || 'Customer'} · ${customer.phone || '—'} · ${format(new Date(request.created_at), 'dd MMM yyyy HH:mm')}`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_VARIANT[request.status] || 'muted'}>{request.status}</Badge>
        <Badge variant="outline">{request.jewellery_type}</Badge>
        <Badge variant="outline">{String(request.purity || '').toUpperCase()}</Badge>
        <Badge variant="outline">{request.metal_color} gold</Badge>
      </div>

      <div className="space-y-4">
        <section className="rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-5">
          <p className="text-sm text-navy">
            {request.gold_weight_grams} g
            {request.size_label ? ` · ${request.size_label}` : ''}
            {request.budget_aed != null ? ` · budget ${formatAED(request.budget_aed)}` : ''}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">{request.description}</p>
          {request.images?.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto">
              {request.images.map((image, index) => (
                <a key={image.key || index} href={image.url || image.key} target="_blank" rel="noreferrer">
                  <img src={image.url || image.key} alt="" className="h-28 w-28 rounded-xl border border-gold/20 object-cover bg-ivory" />
                </a>
              ))}
            </div>
          )}
        </section>

        {quote && (
          <section className="rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-5">
            <p className="font-semibold text-navy">Quoted total {formatAED(quote.total)}</p>
            <p className="mt-1 text-xs text-muted">
              Gold {formatAED(quote.gold_value)} · Making {formatAED(quote.making_charge)} · Wastage {formatAED(quote.wastage_amount)} · Stones {formatAED(quote.stone_charge)} · VAT {formatAED(quote.vat_amount)}
            </p>
            {quote.notes && <p className="mt-2 text-sm text-navy">{quote.notes}</p>}
            {quote.valid_until && (
              <p className="mt-1 text-xs text-muted">Valid until {format(new Date(quote.valid_until), 'dd MMM yyyy')}</p>
            )}
          </section>
        )}

        {request.decline_reason && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#b3261e]">
            Decline reason: {request.decline_reason}
          </p>
        )}

        {['submitted', 'quoted'].includes(request.status) && <QuoteForm request={request} />}

        {request.status === 'accepted' && (
          <Button disabled={action.isPending} onClick={complete}>Mark completed</Button>
        )}
      </div>
    </div>
  )
}
