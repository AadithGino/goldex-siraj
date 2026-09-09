import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Sparkles, Upload } from 'lucide-react'
import { RequireCustomer } from '@/components/auth/RequireCustomer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FileUploadField } from '@/components/ui/file-upload-field'
import { LabeledSelect } from '@/components/ui/labeled-select'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { useGoldRate } from '@/hooks/useGoldRate'
import { useCreateCustomRequest, useCustomRequestAction, useMyCustomRequests } from '@/hooks/useCustomRequests'
import { formatAED } from '@/lib/pricing'
import { uploadCustomJewelleryImage } from '@/lib/storage'
import { Skeleton } from '@/components/ui/skeleton'

const TYPES = ['ring', 'necklace', 'bracelet', 'earring', 'bangle', 'pendant', 'other']
const PURITIES = ['24k', '22k', '21k', '18k', '14k']
const COLORS = ['yellow', 'white', 'rose']
const STATUS_VARIANT = {
  submitted: 'gold',
  quoted: 'navy',
  accepted: 'success',
  declined: 'destructive',
  cancelled: 'muted',
  completed: 'success',
}

const emptyForm = {
  jewellery_type: 'ring',
  purity: '22k',
  metal_color: 'yellow',
  gold_weight_grams: '',
  size_label: '',
  description: '',
  budget_aed: '',
}

function QuoteBreakdown({ quote, t }) {
  if (!quote) return null
  const expired = quote.valid_until && new Date(quote.valid_until).getTime() < Date.now()
  const rows = [
    [t('custom:quoteGold'), formatAED(quote.gold_value)],
    [t('custom:quoteWastage'), formatAED(quote.wastage_amount)],
    [t('custom:quoteMaking'), formatAED(quote.making_charge)],
    [t('custom:quoteStone'), formatAED(quote.stone_charge)],
    [t('custom:quoteVat'), formatAED(quote.vat_amount)],
  ]
  return (
    <div className="mt-4 rounded-2xl border border-gold/20 bg-ivory p-4">
      <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('custom:quoteTitle')}</p>
      {expired && <p className="mt-2 text-sm text-[#b3261e]">{t('custom:quoteExpired')}</p>}
      <dl className="mt-3 space-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted">{label}</dt>
            <dd className="font-medium text-navy">{value}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-gold/15 pt-2 text-navy">
          <dt className="font-semibold">{t('custom:quoteTotal')}</dt>
          <dd className="font-display text-lg text-gold">{formatAED(quote.total)}</dd>
        </div>
      </dl>
      {quote.valid_until && !expired && (
        <p className="mt-2 text-xs text-muted">
          {t('custom:quoteValidUntil', { date: new Date(quote.valid_until).toLocaleDateString() })}
        </p>
      )}
      {quote.notes && (
        <p className="mt-2 text-sm text-navy">
          <span className="font-medium">{t('custom:quoteNotes')}: </span>
          {quote.notes}
        </p>
      )}
    </div>
  )
}

function RequestCard({ request, t, onAction, busy }) {
  const images = request.images || []
  const expired = request.status === 'quoted' && request.quote?.valid_until
    && new Date(request.quote.valid_until).getTime() < Date.now()

  return (
    <article className="rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-navy">{t('custom:requestNumber', { number: request.request_number })}</p>
        <Badge variant={STATUS_VARIANT[request.status] || 'muted'}>
          {t(`custom:status.${request.status}`)}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted">
        {t(`custom:types.${request.jewellery_type}`)} · {t('custom:weightLine', {
          weight: request.gold_weight_grams,
          purity: String(request.purity || '').toUpperCase(),
        })}
      </p>
      {images.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((image, index) => (
            <img
              key={image.key || index}
              src={image.url || image.key}
              alt=""
              className="h-20 w-20 shrink-0 rounded-xl border border-gold/20 object-cover bg-ivory"
            />
          ))}
        </div>
      )}
      <p className="mt-3 text-sm leading-relaxed text-navy">{request.description}</p>
      <QuoteBreakdown quote={request.quote} t={t} />
      <div className="mt-4 flex flex-wrap gap-2">
        {request.status === 'quoted' && !expired && (
          <>
            <Button size="sm" disabled={busy} onClick={() => onAction(request.id, 'accept')}>
              {t('custom:acceptQuote')}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction(request.id, 'decline')}>
              {t('custom:declineQuote')}
            </Button>
          </>
        )}
        {['submitted', 'quoted'].includes(request.status) && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAction(request.id, 'cancel')}>
            {t('custom:cancelRequest')}
          </Button>
        )}
      </div>
    </article>
  )
}

function CustomJewelleryForm({ t, onSubmitted }) {
  const create = useCreateCustomRequest()
  const { data: rates } = useGoldRate()
  const [form, setForm] = useState(emptyForm)
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const liveRate = rates?.find((rate) => rate.purity === form.purity)

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const handleUpload = async (file, index) => {
    setUploading(true)
    try {
      const uploaded = await uploadCustomJewelleryImage(file)
      setImages((prev) => {
        const next = [...prev]
        next[index] = uploaded
        return next
      })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const keys = images.map((image) => image?.key).filter(Boolean)
    if (!keys.length) {
      toast.error(t('custom:imagesHint'))
      return
    }
    try {
      await create.mutateAsync({
        jewellery_type: form.jewellery_type,
        purity: form.purity,
        metal_color: form.metal_color,
        gold_weight_grams: Number(form.gold_weight_grams),
        size_label: form.size_label,
        description: form.description,
        budget_aed: form.budget_aed === '' ? null : Number(form.budget_aed),
        image_keys: keys,
      })
      toast.success(t('custom:submittedToast'))
      setForm(emptyForm)
      setImages([])
      onSubmitted?.()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4 rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-6">
      <h2 className="font-display text-xl text-navy">{t('custom:formTitle')}</h2>
      {liveRate && (
        <p className="text-sm text-gold">
          {t('custom:liveRate', {
            purity: form.purity.toUpperCase(),
            rate: formatAED(liveRate.rate_per_gram),
          })}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <LabeledSelect
          label={t('custom:jewelleryType')}
          value={form.jewellery_type}
          onValueChange={(jewellery_type) => update({ jewellery_type })}
          options={TYPES.map((value) => ({ value, label: t(`custom:types.${value}`) }))}
        />
        <LabeledSelect
          label={t('custom:purity')}
          value={form.purity}
          onValueChange={(purity) => update({ purity })}
          options={PURITIES.map((value) => ({ value, label: value.toUpperCase() }))}
        />
        <LabeledSelect
          label={t('custom:metalColor')}
          value={form.metal_color}
          onValueChange={(metal_color) => update({ metal_color })}
          options={COLORS.map((value) => ({ value, label: t(`custom:colors.${value}`) }))}
        />
        <div>
          <label className="mb-2 block text-sm font-medium text-navy">{t('custom:goldWeight')}</label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={form.gold_weight_grams}
            onChange={(e) => update({ gold_weight_grams: e.target.value })}
          />
          <p className="mt-1 text-xs text-muted">{t('custom:goldWeightHint')}</p>
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-navy">{t('custom:sizeLabel')}</label>
        <Input
          value={form.size_label}
          onChange={(e) => update({ size_label: e.target.value })}
          placeholder={t('custom:sizePlaceholder')}
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-navy">{t('custom:description')}</label>
        <textarea
          required
          minLength={10}
          rows={4}
          value={form.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder={t('custom:descriptionPlaceholder')}
          className="w-full rounded-2xl border border-gold/20 bg-ivory-2 px-4 py-3 text-sm text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-navy">{t('custom:budget')}</label>
        <Input
          type="number"
          min="0"
          step="1"
          value={form.budget_aed}
          onChange={(e) => update({ budget_aed: e.target.value })}
        />
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium text-navy">{t('custom:images')}</p>
        {(images.length ? images : [null]).map((image, index) => (
          <FileUploadField
            key={image?.key || `slot-${index}`}
            accept="image/jpeg,image/png,image/webp"
            hint={index === 0 ? t('custom:imagesHint') : undefined}
            fileName={image?.key ? 'Design photo' : ''}
            previewUrl={image?.previewUrl}
            uploading={uploading}
            onFile={(file) => handleUpload(file, index)}
            onClear={() => setImages((prev) => prev.filter((_, i) => i !== index))}
          />
        ))}
        {images.length > 0 && images.length < 5 && images.every(Boolean) && (
          <Button type="button" variant="outline" size="sm" onClick={() => setImages((prev) => [...prev, null])}>
            <Upload className="h-4 w-4" />
            {t('custom:addImage')}
          </Button>
        )}
      </div>
      <Button type="submit" disabled={create.isPending || uploading} className="w-full sm:w-auto">
        {t('custom:submit')}
      </Button>
    </form>
  )
}

function CustomJewelleryContent() {
  const { t } = useTranslation(['custom', 'common'])
  const { data: requests, isLoading } = useMyCustomRequests()
  const action = useCustomRequestAction()
  const [tab, setTab] = useState('new')
  const [selectedId, setSelectedId] = useState(null)

  const handleAction = async (id, type) => {
    try {
      await action.mutateAsync({ id, action: type })
      toast.success(t(`custom:${type === 'accept' ? 'acceptedToast' : type === 'decline' ? 'declinedToast' : 'cancelledToast'}`))
    } catch (err) {
      toast.error(err.message)
    }
  }

  const selected = requests?.find((request) => request.id === selectedId)

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('custom:eyebrow')}</p>
        <h1 className="font-display text-[clamp(28px,3.3vw,46px)] text-navy">{t('custom:title')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t('custom:subtitle')}</p>
      </div>

      <div className="mb-6 flex gap-2 border-b border-gold/20">
        {[
          { id: 'new', label: t('custom:tabNew') },
          { id: 'requests', label: t('custom:tabRequests', { count: requests?.length || 0 }) },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id)
              setSelectedId(null)
            }}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
              tab === item.id
                ? 'border-gold text-navy'
                : 'border-transparent text-muted hover:text-navy'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'new' && (
        <CustomJewelleryForm
          t={t}
          onSubmitted={() => {
            setTab('requests')
            setSelectedId(null)
          }}
        />
      )}

      {tab === 'requests' && (
        <div className="mx-auto max-w-3xl">
          {selected ? (
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mb-3 -ml-2"
                onClick={() => setSelectedId(null)}
              >
                <ChevronLeft className="h-4 w-4" />
                {t('custom:backToList')}
              </Button>
              <RequestCard
                request={selected}
                t={t}
                busy={action.isPending}
                onAction={handleAction}
              />
            </div>
          ) : isLoading ? (
            <Skeleton className="h-40 w-full rounded-[28px]" />
          ) : requests?.length ? (
            <div className="space-y-2">
              {requests.map((request) => (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => setSelectedId(request.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-[28px] border border-gold/20 bg-ivory-2 p-4 text-left transition-colors hover:border-gold/40 sm:p-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-navy">
                        {t('custom:requestNumber', { number: request.request_number })}
                      </span>
                      <Badge variant={STATUS_VARIANT[request.status] || 'muted'}>
                        {t(`custom:status.${request.status}`)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {t(`custom:types.${request.jewellery_type}`)} · {t('custom:weightLine', {
                        weight: request.gold_weight_grams,
                        purity: String(request.purity || '').toUpperCase(),
                      })}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-gold/30 bg-ivory-2 p-8 text-center">
              <p className="text-sm text-muted">{t('custom:noRequests')}</p>
              <Button type="button" className="mt-4" onClick={() => setTab('new')}>
                {t('custom:tabNew')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function CustomJewelleryPage() {
  const { t } = useTranslation('custom')
  const { isAuthenticated, isLoading } = useCustomerAuth()

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1320px] px-4 py-10">
        <Skeleton className="h-64 w-full rounded-[28px]" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-gold" />
        <h1 className="mt-4 font-display text-3xl text-navy">{t('title')}</h1>
        <p className="mt-2 text-sm text-muted">{t('needLogin')}</p>
        <Button asChild className="mt-6">
          <Link to="/login" state={{ from: '/custom-jewellery' }}>{t('cta')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <RequireCustomer>
      <CustomJewelleryContent />
    </RequireCustomer>
  )
}
