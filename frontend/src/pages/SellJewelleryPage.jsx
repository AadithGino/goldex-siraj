import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Coins, ChevronLeft, ChevronRight, LocateFixed, Upload } from 'lucide-react'
import { RequireCustomer } from '@/components/auth/RequireCustomer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FileUploadField } from '@/components/ui/file-upload-field'
import { LabeledSelect } from '@/components/ui/labeled-select'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { useGoldBuybackRate } from '@/hooks/useGoldRate'
import { useCreateSellRequest, useMySellRequests, useSellRequestAction } from '@/hooks/useSellRequests'
import { isValidUaeMobile, normalizeUaePhone } from '@/lib/addressFormat'
import { getUaeEmirates } from '@/lib/i18nLabels'
import { formatAED } from '@/lib/pricing'
import { uploadSellInvoice, uploadSellJewelleryImage } from '@/lib/storage'
import { Skeleton } from '@/components/ui/skeleton'

const TYPES = ['ring', 'necklace', 'bracelet', 'earring', 'bangle', 'pendant', 'other']
const PURITIES = ['24k', '22k', '21k', '18k', '14k']
const STATUS_VARIANT = {
  submitted: 'gold',
  needs_info: 'navy',
  offered: 'navy',
  accepted: 'success',
  declined: 'destructive',
  cancelled: 'muted',
  completed: 'success',
}

const emptyForm = {
  jewellery_type: 'necklace',
  purity: '22k',
  net_weight_grams: '',
  notes: '',
  recipient_name: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: 'Dubai',
  pincode: '',
  latitude: '',
  longitude: '',
}

function estimateAmount(weight, rate) {
  const w = Number(weight)
  const r = Number(rate)
  if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(r) || r <= 0) return null
  return Math.round((w * r + Number.EPSILON) * 100) / 100
}

function mapsUrl(lat, lng) {
  if (lat == null || lng == null || lat === '' || lng === '') return null
  return `https://maps.google.com/?q=${encodeURIComponent(`${lat},${lng}`)}`
}

function OfferBreakdown({ offer, t }) {
  if (!offer) return null
  const expired = offer.valid_until && new Date(offer.valid_until).getTime() < Date.now()
  return (
    <div className="mt-4 rounded-2xl border border-gold/20 bg-ivory p-4">
      <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('sell:offerTitle')}</p>
      {expired && <p className="mt-2 text-sm text-[#b3261e]">{t('sell:offerExpired')}</p>}
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{t('sell:offerWeight')}</dt>
          <dd className="font-medium text-navy">{offer.net_weight_grams} g</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{t('sell:offerRate')}</dt>
          <dd className="font-medium text-navy">{formatAED(offer.rate_per_gram)}/g</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-gold/15 pt-2 text-navy">
          <dt className="font-semibold">{t('sell:offerAmount')}</dt>
          <dd className="font-display text-lg text-gold">{formatAED(offer.amount)}</dd>
        </div>
      </dl>
      {offer.valid_until && !expired && (
        <p className="mt-2 text-xs text-muted">
          {t('sell:offerValidUntil', { date: new Date(offer.valid_until).toLocaleDateString() })}
        </p>
      )}
      {offer.notes && (
        <p className="mt-2 text-sm text-navy">
          <span className="font-medium">{t('sell:offerNotes')}: </span>
          {offer.notes}
        </p>
      )}
    </div>
  )
}

function RequestCard({ request, t, onAction, busy }) {
  const [reply, setReply] = useState('')
  const [extraImages, setExtraImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const images = request.images || []
  const address = request.pickup_address || {}
  const expired = request.status === 'offered' && request.offer?.valid_until
    && new Date(request.offer.valid_until).getTime() < Date.now()
  const map = mapsUrl(address.latitude, address.longitude)

  const handleExtraUpload = async (file, index) => {
    setUploading(true)
    try {
      const uploaded = await uploadSellJewelleryImage(file)
      setExtraImages((prev) => {
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

  return (
    <article className="rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-navy">{t('sell:requestNumber', { number: request.request_number })}</p>
        <Badge variant={STATUS_VARIANT[request.status] || 'muted'}>
          {t(`sell:status.${request.status}`)}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted">
        {t(`sell:types.${request.jewellery_type}`)} · {t('sell:weightLine', {
          weight: request.net_weight_grams,
          purity: String(request.purity || '').toUpperCase(),
        })}
      </p>
      {request.indicative?.amount != null && (
        <p className="mt-1 text-sm text-gold">
          {t('sell:indicativeTitle')}: {formatAED(request.indicative.amount)}
        </p>
      )}
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
      {request.invoice?.key && (
        <a
          href={request.invoice.url || request.invoice.key}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex text-xs font-semibold text-gold hover:underline"
        >
          {t('sell:invoiceFile')}
        </a>
      )}
      {request.notes && <p className="mt-3 text-sm leading-relaxed text-navy">{request.notes}</p>}
      <p className="mt-2 text-xs text-muted">
        {[address.line1, address.city, address.state].filter(Boolean).join(', ')}
      </p>
      {map && (
        <a href={map} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-xs font-semibold text-gold hover:underline">
          {t('sell:openMap')}
        </a>
      )}
      {request.messages?.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-gold">{t('sell:messagesTitle')}</p>
          {request.messages.map((message, index) => (
            <p key={`${message.created_at}-${index}`} className="rounded-xl bg-ivory px-3 py-2 text-sm text-navy">
              {message.body}
            </p>
          ))}
        </div>
      )}
      <OfferBreakdown offer={request.offer} t={t} />
      {request.status === 'needs_info' && (
        <div className="mt-4 space-y-3">
          <textarea
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={t('sell:replyPlaceholder')}
            className="w-full rounded-2xl border border-gold/20 bg-ivory px-4 py-3 text-sm text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30"
          />
          {(extraImages.length ? extraImages : [null]).map((image, index) => (
            <FileUploadField
              key={image?.key || `reply-${index}`}
              accept="image/jpeg,image/png,image/webp"
              fileName={image?.key ? 'Photo' : ''}
              previewUrl={image?.previewUrl}
              uploading={uploading}
              onFile={(file) => handleExtraUpload(file, index)}
              onClear={() => setExtraImages((prev) => prev.filter((_, i) => i !== index))}
            />
          ))}
          <Button
            size="sm"
            disabled={busy || uploading || reply.trim().length < 4}
            onClick={() => onAction(request.id, 'reply', {
              message: reply.trim(),
              image_keys: extraImages.map((image) => image?.key).filter(Boolean),
            })}
          >
            {t('sell:replySubmit')}
          </Button>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {request.status === 'offered' && !expired && (
          <>
            <Button size="sm" disabled={busy} onClick={() => onAction(request.id, 'accept')}>
              {t('sell:acceptOffer')}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction(request.id, 'decline')}>
              {t('sell:declineOffer')}
            </Button>
          </>
        )}
        {['submitted', 'needs_info', 'offered'].includes(request.status) && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAction(request.id, 'cancel')}>
            {t('sell:cancelRequest')}
          </Button>
        )}
      </div>
    </article>
  )
}

function SellJewelleryForm({ t, onSubmitted }) {
  const create = useCreateSellRequest()
  const { data: rates } = useGoldBuybackRate()
  const emirates = useMemo(() => getUaeEmirates(t), [t])
  const [form, setForm] = useState(emptyForm)
  const [images, setImages] = useState([])
  const [invoice, setInvoice] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [locating, setLocating] = useState(false)
  const liveRate = rates?.find((rate) => rate.purity === form.purity)
  const estimate = estimateAmount(form.net_weight_grams, liveRate?.rate_per_gram)

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const handleUpload = async (file, index) => {
    setUploading(true)
    try {
      const uploaded = await uploadSellJewelleryImage(file)
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

  const handleInvoice = async (file) => {
    setUploading(true)
    try {
      setInvoice(await uploadSellInvoice(file))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error(t('sell:locationUnavailable'))
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        update({
          latitude: String(position.coords.latitude.toFixed(7)),
          longitude: String(position.coords.longitude.toFixed(7)),
        })
        setLocating(false)
      },
      (error) => {
        setLocating(false)
        toast.error(error?.code === 1 ? t('sell:locationDenied') : t('sell:locationUnavailable'))
      },
      { enableHighAccuracy: true, timeout: 12_000 },
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const keys = images.map((image) => image?.key).filter(Boolean)
    if (!keys.length) {
      toast.error(t('sell:imagesHint'))
      return
    }
    if (!liveRate) {
      toast.error(t('sell:noLiveRate'))
      return
    }
    const phone = normalizeUaePhone(form.phone)
    if (!isValidUaeMobile(phone)) {
      toast.error(t('checkout:address.phoneInvalid'))
      return
    }
    const latitude = form.latitude === '' ? null : Number(form.latitude)
    const longitude = form.longitude === '' ? null : Number(form.longitude)
    try {
      await create.mutateAsync({
        jewellery_type: form.jewellery_type,
        purity: form.purity,
        net_weight_grams: Number(form.net_weight_grams),
        notes: form.notes,
        image_keys: keys,
        invoice_key: invoice?.key || null,
        pickup_address: {
          recipient_name: form.recipient_name,
          phone,
          line1: form.line1,
          line2: form.line2,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          country: 'United Arab Emirates',
          latitude: Number.isFinite(latitude) ? latitude : null,
          longitude: Number.isFinite(longitude) ? longitude : null,
        },
      })
      toast.success(t('sell:submittedToast'))
      setForm(emptyForm)
      setImages([])
      setInvoice(null)
      onSubmitted?.()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4 rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-6">
      <h2 className="font-display text-xl text-navy">{t('sell:formTitle')}</h2>
      {liveRate ? (
        <p className="text-sm text-gold">
          {t('sell:liveRate', {
            purity: form.purity.toUpperCase(),
            rate: formatAED(liveRate.rate_per_gram),
          })}
        </p>
      ) : (
        <p className="text-sm text-[#b3261e]">{t('sell:noLiveRate')}</p>
      )}
      {estimate != null && (
        <p className="font-display text-2xl text-navy">{t('sell:liveEstimate', { amount: formatAED(estimate) })}</p>
      )}
      <p className="text-xs text-muted">{t('sell:indicativeHint')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <LabeledSelect
          label={t('sell:jewelleryType')}
          value={form.jewellery_type}
          onValueChange={(jewellery_type) => update({ jewellery_type })}
          options={TYPES.map((value) => ({ value, label: t(`sell:types.${value}`) }))}
        />
        <LabeledSelect
          label={t('sell:purity')}
          value={form.purity}
          onValueChange={(purity) => update({ purity })}
          options={PURITIES.map((value) => ({ value, label: value.toUpperCase() }))}
        />
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-medium text-navy">{t('sell:netWeight')}</label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={form.net_weight_grams}
            onChange={(e) => update({ net_weight_grams: e.target.value })}
          />
          <p className="mt-1 text-xs text-muted">{t('sell:netWeightHint')}</p>
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-navy">{t('sell:notes')}</label>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder={t('sell:notesPlaceholder')}
          className="w-full rounded-2xl border border-gold/20 bg-ivory-2 px-4 py-3 text-sm text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30"
        />
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium text-navy">{t('sell:images')}</p>
        {(images.length ? images : [null]).map((image, index) => (
          <FileUploadField
            key={image?.key || `slot-${index}`}
            accept="image/jpeg,image/png,image/webp"
            hint={index === 0 ? t('sell:imagesHint') : undefined}
            fileName={image?.key ? 'Jewellery photo' : ''}
            previewUrl={image?.previewUrl}
            uploading={uploading}
            onFile={(file) => handleUpload(file, index)}
            onClear={() => setImages((prev) => prev.filter((_, i) => i !== index))}
          />
        ))}
        {images.length > 0 && images.length < 5 && images.every(Boolean) && (
          <Button type="button" variant="outline" size="sm" onClick={() => setImages((prev) => [...prev, null])}>
            <Upload className="h-4 w-4" />
            {t('sell:addImage')}
          </Button>
        )}
      </div>
      <FileUploadField
        label={t('sell:invoice')}
        accept="image/jpeg,image/png,image/webp,application/pdf"
        hint={t('sell:invoiceHint')}
        fileName={invoice?.key ? t('sell:invoiceFile') : ''}
        previewUrl={invoice?.previewUrl}
        uploading={uploading}
        onFile={handleInvoice}
        onClear={() => setInvoice(null)}
      />
      <div className="space-y-3 border-t border-gold/15 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-navy">{t('sell:addressTitle')}</p>
          <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating}>
            <LocateFixed className="h-4 w-4" />
            {t('sell:useMyLocation')}
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">{t('checkout:address.fullName')}</label>
            <Input required value={form.recipient_name} onChange={(e) => update({ recipient_name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">{t('checkout:address.mobileUae')}</label>
            <Input
              required
              type="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => update({ phone: e.target.value.replace(/\D/g, '').slice(0, 9) })}
              placeholder={t('checkout:address.phonePlaceholder')}
            />
          </div>
          <LabeledSelect
            label={t('checkout:address.emirate')}
            value={form.state}
            onValueChange={(state) => update({ state })}
            options={emirates.map(({ value, label }) => ({ value, label }))}
          />
          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">{t('checkout:address.area')}</label>
            <Input required value={form.city} onChange={(e) => update({ city: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy">{t('checkout:address.buildingStreet')}</label>
          <Input required value={form.line1} onChange={(e) => update({ line1: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy">{t('checkout:address.line2Label')}</label>
          <Input value={form.line2} onChange={(e) => update({ line2: e.target.value })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">{t('checkout:address.latitude')}</label>
            <Input
              type="number"
              step="0.0000001"
              min="-90"
              max="90"
              value={form.latitude}
              onChange={(e) => update({ latitude: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">{t('checkout:address.longitude')}</label>
            <Input
              type="number"
              step="0.0000001"
              min="-180"
              max="180"
              value={form.longitude}
              onChange={(e) => update({ longitude: e.target.value })}
            />
          </div>
        </div>
        <p className="text-xs text-muted">{t('checkout:address.mapCoordinatesHint')}</p>
      </div>
      <Button type="submit" disabled={create.isPending || uploading || !liveRate} className="w-full sm:w-auto">
        {t('sell:submit')}
      </Button>
    </form>
  )
}

function SellJewelleryContent() {
  const { t } = useTranslation(['sell', 'common', 'checkout'])
  const { data: requests, isLoading } = useMySellRequests()
  const action = useSellRequestAction()
  const [tab, setTab] = useState('new')
  const [selectedId, setSelectedId] = useState(null)

  const handleAction = async (id, type, body) => {
    try {
      await action.mutateAsync({ id, action: type, body })
      const toastKey = type === 'accept'
        ? 'acceptedToast'
        : type === 'decline'
          ? 'declinedToast'
          : type === 'reply'
            ? 'repliedToast'
            : 'cancelledToast'
      toast.success(t(`sell:${toastKey}`))
    } catch (err) {
      toast.error(err.message)
    }
  }

  const selected = requests?.find((request) => request.id === selectedId)

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('sell:eyebrow')}</p>
        <h1 className="font-display text-[clamp(28px,3.3vw,46px)] text-navy">{t('sell:title')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t('sell:subtitle')}</p>
      </div>

      <div className="mb-6 flex gap-2 border-b border-gold/20">
        {[
          { id: 'new', label: t('sell:tabNew') },
          { id: 'requests', label: t('sell:tabRequests', { count: requests?.length || 0 }) },
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
        <SellJewelleryForm
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
                {t('sell:backToList')}
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
                        {t('sell:requestNumber', { number: request.request_number })}
                      </span>
                      <Badge variant={STATUS_VARIANT[request.status] || 'muted'}>
                        {t(`sell:status.${request.status}`)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {t(`sell:types.${request.jewellery_type}`)} · {t('sell:weightLine', {
                        weight: request.net_weight_grams,
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
              <p className="text-sm text-muted">{t('sell:noRequests')}</p>
              <Button type="button" className="mt-4" onClick={() => setTab('new')}>
                {t('sell:tabNew')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function SellJewelleryPage() {
  const { t } = useTranslation('sell')
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
        <Coins className="mx-auto h-8 w-8 text-gold" />
        <h1 className="mt-4 font-display text-3xl text-navy">{t('title')}</h1>
        <p className="mt-2 text-sm text-muted">{t('needLogin')}</p>
        <Button asChild className="mt-6">
          <Link to="/login" state={{ from: '/sell-jewellery' }}>{t('cta')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <RequireCustomer>
      <SellJewelleryContent />
    </RequireCustomer>
  )
}
