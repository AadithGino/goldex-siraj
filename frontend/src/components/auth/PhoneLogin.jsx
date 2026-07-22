import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function PhoneLogin({ onSubmit, isLoading }) {
  const { t } = useTranslation(['auth', 'common'])
  const [phone, setPhone] = useState('')

  const normalizePhone = (raw) => {
    const input = String(raw || '').trim()
    if (!input) return null

    if (input.startsWith('+')) {
      const cleaned = `+${input.slice(1).replace(/\D/g, '')}`
      return cleaned.length > 1 ? cleaned : null
    }

    const digits = input.replace(/\D/g, '')
    if (!digits) return null

    if (digits.startsWith('971')) {
      return `+${digits}`
    }

    if (digits.length === 10 && digits.startsWith('0')) {
      return `+971${digits.slice(1)}`
    }

    if (digits.length === 9) {
      return `+971${digits}`
    }

    return `+971${digits}`
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const normalized = normalizePhone(phone)
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
          <span className="flex h-12 items-center rounded-full border border-gold/20 bg-ivory-3 px-4 text-sm text-muted">
            {t('auth:countryCodeIn')}
          </span>
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
        <p className="mt-1 text-xs text-muted">{t('auth:phoneHelper')}</p>
      </div>
      <Button type="submit" className="w-full" disabled={isLoading || !phone.trim()}>
        {isLoading ? t('common:sending') : t('auth:sendOtp')}
      </Button>
    </form>
  )
}
