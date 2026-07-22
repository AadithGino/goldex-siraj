import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { PhoneLogin } from '@/components/auth/PhoneLogin'
import { OtpInput } from '@/components/auth/OtpInput'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { PolicyLinks } from '@/components/legal/PolicyLinks'

export function LoginPage() {
  const { t } = useTranslation(['auth', 'common', 'errors'])
  const navigate = useNavigate()
  const location = useLocation()
  const { otpPhone, requestOtp, verifyOtp } = useCustomerAuth()
  const [step, setStep] = useState('phone')
  const [isRequestingOtp, setIsRequestingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [testOtp, setTestOtp] = useState(null)

  const from = location.state?.from || '/'

  useEffect(() => () => setTestOtp(null), [])

  const clearTestOtp = () => setTestOtp(null)

  const handlePhoneSubmit = async (phone) => {
    try {
      setIsRequestingOtp(true)
      clearTestOtp()
      const result = await requestOtp(phone)
      const nextTestOtp = typeof result?.test_otp === 'string' && /^\d{6}$/.test(result.test_otp)
        ? result.test_otp
        : null
      setTestOtp(nextTestOtp)
      setStep('otp')
      toast.success(t('common:otpSentDemo'))
    } catch (err) {
      clearTestOtp()
      toast.error(err.message || t('errors:auth.sendOtpFailed'))
    } finally {
      setIsRequestingOtp(false)
    }
  }

  const handleOtpSubmit = async (code) => {
    try {
      setIsVerifyingOtp(true)
      await verifyOtp(otpPhone, code)
      clearTestOtp()
      toast.success(t('common:welcomeBack'))
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err.message || t('errors:auth.invalidOtp'))
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const handleBackToPhone = () => {
    clearTestOtp()
    setStep('phone')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-16">
      <div className="text-center">
        <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('auth:accountEyebrow')}</p>
        <h1 className="mt-2 font-display text-3xl text-navy">{t('auth:title')}</h1>
        <p className="mt-2 text-sm text-muted">
          {t('auth:subtitle')}
        </p>
      </div>

      <div className="mt-8 rounded-[28px] border border-gold/20 bg-ivory-2 p-6 shadow-[0_14px_34px_rgba(7,21,37,.09)]">
        {step === 'phone' ? (
          <PhoneLogin onSubmit={handlePhoneSubmit} isLoading={isRequestingOtp} />
        ) : (
          <OtpInput
            phone={otpPhone}
            onSubmit={handleOtpSubmit}
            onBack={handleBackToPhone}
            isLoading={isVerifyingOtp}
            testOtp={testOtp}
          />
        )}
      </div>

      <div className="mt-6 text-center">
        <p className="text-xs leading-relaxed text-muted">{t('auth:policiesNotice')}</p>
        <PolicyLinks className="mt-3" />
      </div>
    </div>
  )
}
