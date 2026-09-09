import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const COUNTRY_CODES = [
  { code: '+971', labelKey: 'uae' },
  { code: '+91', labelKey: 'india' },
  { code: '+966', labelKey: 'saudi' },
  { code: '+965', labelKey: 'kuwait' },
  { code: '+968', labelKey: 'oman' },
  { code: '+973', labelKey: 'bahrain' },
  { code: '+974', labelKey: 'qatar' },
]

export function PhoneLogin({ onSubmit, isLoading }) {
  const { t } = useTranslation(['auth', 'common'])
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState('+971')

  const normalizePhone = (raw, selectedCode) => {
    const input = String(raw || '').trim()
    if (!input) return null

    if (input.startsWith('+')) {
      const cleaned = `+${input.slice(1).replace(/\D/g, '')}`
      return cleaned.length > 1 ? cleaned : null
    }

    const digits = input.replace(/\D/g, '')
    const selectedDigits = String(selectedCode || '+971').replace(/[^\d]/g, '')
    if (!digits || !selectedDigits) return null
    if (digits.startsWith(selectedDigits)) return `+${digits}`
    const localDigits = digits.replace(/^0+/, '')
    return localDigits ? `+${selectedDigits}${localDigits}` : null
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const normalized = normalizePhone(phone, countryCode)
    if (!normalized) return
    onSubmit(normalized)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="phone" className="mb-2 block text-sm font-medium text-navy">
          {t('auth:mobileLabel')}
        </label>
        <div className="flex gap-2">
          <Select value={countryCode} onValueChange={setCountryCode}>
            <SelectTrigger className="w-33 shrink-0 bg-ivory-3 text-left">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_CODES.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {`${option.code} ${t(`auth:countryNames.${option.labelKey}`)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            maxLength={18}
            placeholder={t('auth:phonePlaceholder')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
        <p className="mt-1 text-xs text-muted">{t('auth:phoneHelperWithCode')}</p>
      </div>
      <Button type="submit" className="w-full" disabled={isLoading || !phone.trim()}>
        {isLoading ? t('common:sending') : t('auth:sendOtp')}
      </Button>
    </form>
  )
}
