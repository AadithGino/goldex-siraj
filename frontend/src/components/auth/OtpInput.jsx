import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function OtpInput({ phone, onSubmit, onBack, isLoading, testOtp }) {
  const { t } = useTranslation(['auth', 'common'])
  const [code, setCode] = useState('')
  const showTestOtp = typeof testOtp === 'string' && /^\d{6}$/.test(testOtp)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (code.length !== 6) return
    onSubmit(code)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted">
        {t('auth:otpIntro')}{' '}
        <span className="font-semibold text-navy">{phone}</span>
      </p>
      {showTestOtp ? (
        <div
          role="note"
          aria-label={t('auth:testOtpTitle')}
          className="rounded-2xl border border-dashed border-gold/40 bg-ivory-3/80 px-4 py-3 text-start"
        >
          <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('auth:testOtpTitle')}</p>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-[0.35em] text-navy" aria-live="polite">
            {testOtp}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">{t('auth:testOtpWarning')}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full"
            onClick={() => setCode(testOtp)}
          >
            {t('auth:fillTestOtp')}
          </Button>
        </div>
      ) : null}
      <div>
        <label htmlFor="otp" className="mb-2 block text-sm font-medium text-navy">
          {t('auth:otpLabel')}
        </label>
        <Input
          id="otp"
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder={t('auth:otpPlaceholder')}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          required
          autoFocus
          autoComplete="one-time-code"
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading || code.length !== 6}>
        {isLoading ? t('common:verifying') : t('auth:verifySignIn')}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        {t('auth:changeNumber')}
      </Button>
    </form>
  )
}
