import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { isValidUaeMobile, normalizeUaePhone } from '@/lib/addressFormat'
import { getAddressLabels, getUaeEmirates } from '@/lib/i18nLabels'

function normalizeAddressLabel(label) {
  const key = String(label || 'home').toLowerCase()
  if (key === 'home' || key === 'work' || key === 'other') return key
  return 'home'
}

const EMPTY = {
  label: 'home',
  recipient_name: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: 'Dubai',
  pincode: '',
  latitude: '',
  longitude: '',
  is_default: false,
}

export function AddressForm({
  initial,
  onSubmit,
  onCancel,
  isSaving,
  submitLabel,
}) {
  const { t } = useTranslation(['checkout', 'common'])
  const addressLabels = useMemo(() => getAddressLabels(t), [t])
  const emirates = useMemo(() => getUaeEmirates(t), [t])
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    ...initial,
    phone: normalizeUaePhone(initial?.phone || ''),
    latitude: initial?.latitude ?? '',
    longitude: initial?.longitude ?? '',
    label: normalizeAddressLabel(initial?.label),
  }))
  const [phoneError, setPhoneError] = useState('')

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const phone = normalizeUaePhone(form.phone)
    if (!isValidUaeMobile(phone)) {
      const message = t('checkout:address.phoneInvalid')
      setPhoneError(message)
      toast.error(message)
      return
    }
    setPhoneError('')
    const latitude =
      form.latitude === '' || form.latitude == null ? null : Number(form.latitude)
    const longitude =
      form.longitude === '' || form.longitude == null ? null : Number(form.longitude)
    onSubmit({
      ...form,
      phone,
      country: 'United Arab Emirates',
      state: form.state || 'Dubai',
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
    })
  }

  const resolvedSubmitLabel = submitLabel ?? t('common:saveAddress')

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy">{t('checkout:address.label')}</label>
          <Select value={form.label} onValueChange={(v) => update('label', v)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {addressLabels.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy">{t('checkout:address.emirate')}</label>
          <Select value={form.state} onValueChange={(v) => update('state', v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={t('common:selectEmirate')} />
            </SelectTrigger>
            <SelectContent>
              {emirates.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-navy">{t('checkout:address.fullName')}</label>
        <Input
          className="h-9"
          value={form.recipient_name}
          onChange={(e) => update('recipient_name', e.target.value)}
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-navy">{t('checkout:address.mobileUae')}</label>
        <div className="flex gap-2">
          <span className="flex h-9 items-center rounded-lg border border-line bg-ivory-3 px-3 text-sm text-muted">
            {t('checkout:address.countryCodeAe')}
          </span>
          <Input
            className="h-9 flex-1"
            type="tel"
            inputMode="numeric"
            value={form.phone}
            onChange={(e) => {
              update('phone', e.target.value.replace(/\D/g, '').slice(0, 9))
              if (phoneError) setPhoneError('')
            }}
            placeholder={t('checkout:address.phonePlaceholder')}
            required
            maxLength={9}
            aria-invalid={Boolean(phoneError)}
          />
        </div>
        <p className={`mt-1 text-[11px] ${phoneError ? 'text-[#b3261e]' : 'text-muted'}`}>
          {phoneError || t('checkout:address.phoneHelper')}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-navy">{t('checkout:address.buildingStreet')}</label>
        <Input
          className="h-9"
          value={form.line1}
          onChange={(e) => update('line1', e.target.value)}
          placeholder={t('checkout:address.line1Placeholder')}
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-navy">
          {t('checkout:address.line2Label')}
        </label>
        <Input
          className="h-9"
          value={form.line2}
          onChange={(e) => update('line2', e.target.value)}
          placeholder={t('checkout:address.line2Placeholder')}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy">{t('checkout:address.area')}</label>
          <Input
            className="h-9"
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
            placeholder={t('checkout:address.cityPlaceholder')}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy">
            {t('checkout:address.poBoxLabel')}
          </label>
          <Input
            className="h-9"
            value={form.pincode}
            onChange={(e) => update('pincode', e.target.value)}
            placeholder={t('common:optional')}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy">{t('checkout:address.latitude')}</label>
          <Input
            className="h-9"
            type="number"
            step="0.0000001"
            min="-90"
            max="90"
            value={form.latitude}
            onChange={(e) => update('latitude', e.target.value)}
            placeholder={t('common:optional')}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy">{t('checkout:address.longitude')}</label>
          <Input
            className="h-9"
            type="number"
            step="0.0000001"
            min="-180"
            max="180"
            value={form.longitude}
            onChange={(e) => update('longitude', e.target.value)}
            placeholder={t('common:optional')}
          />
        </div>
      </div>
      <p className="text-xs text-muted">{t('checkout:address.mapCoordinatesHint')}</p>
      {form.latitude && form.longitude && (
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(`${form.latitude},${form.longitude}`)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-xs font-semibold text-gold hover:underline"
        >
          {t('checkout:address.openInGoogleMaps')}
        </a>
      )}

      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={form.is_default}
          onChange={(e) => update('is_default', e.target.checked)}
          className="h-4 w-4 accent-(--navy)"
        />
        {t('checkout:address.setDefault')}
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? t('common:saving') : resolvedSubmitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {t('common:cancel')}
          </Button>
        )}
      </div>
    </form>
  )
}
