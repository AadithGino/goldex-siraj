import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RequireCustomer } from '@/components/auth/RequireCustomer'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SchemePayDialog } from '@/components/scheme/SchemePayDialog'
import {
  SchemeEnrollmentSummary,
  SchemeInstallmentTimeline,
} from '@/components/scheme/SchemeEnrollmentCard'
import { useMyEnrollment } from '@/hooks/useSchemes'
import { useWalletBalance } from '@/hooks/useWallet'
import { useStoreSettings } from '@/hooks/useStoreSettings'
import { formatAED } from '@/lib/pricing'
import { getNextDueInstallment } from '@/lib/schemeUtils'

function SchemeEnrollmentDetailContent() {
  const { t } = useTranslation(['scheme', 'common', 'nav'])
  const { id } = useParams()
  const { data: settings } = useStoreSettings()
  const { data: enrollment, isLoading } = useMyEnrollment(id)
  const { data: walletBalance } = useWalletBalance(!!enrollment && enrollment.status === 'completed')
  const [payInstallment, setPayInstallment] = useState(null)
  const onlinePaymentEnabled = settings?.online_payment_enabled === true

  if (settings && settings.gold_scheme_enabled === false) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-3xl text-navy">{t('scheme:unavailableTitle')}</h1>
        <p className="mt-2 text-sm text-muted">{t('scheme:unavailableDesc')}</p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/">{t('nav:home')}</Link>
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 w-full rounded-[28px]" />
      </div>
    )
  }

  if (!enrollment) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-muted">{t('scheme:enrollmentNotFound')}</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/scheme/track">{t('scheme:backToMySchemes')}</Link>
        </Button>
      </div>
    )
  }

  const nextDue = getNextDueInstallment(enrollment.scheme_installments)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
        <Link to="/scheme/track">
          <ChevronLeft className="h-4 w-4" />
          {t('scheme:mySchemes')}
        </Link>
      </Button>

      <SchemeEnrollmentSummary enrollment={enrollment} />

      {enrollment.status === 'completed' && walletBalance != null && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <Wallet className="h-5 w-5 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-emerald-800">{t('scheme:completePayoutTitle')}</p>
            <p className="text-sm text-emerald-700">
              {t('scheme:completePayoutDesc', { balance: formatAED(walletBalance) })}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/account">{t('scheme:viewWallet')}</Link>
          </Button>
        </div>
      )}

      {nextDue && enrollment.status === 'active' && (
        <>
          {onlinePaymentEnabled ? (
            <Button className="mt-4 w-full sm:w-auto" onClick={() => setPayInstallment(nextDue)}>
              {t('scheme:payNextInstallment', { number: nextDue.installment_number })}
            </Button>
          ) : (
            <p className="mt-4 text-sm text-muted">
              Installment payment is currently accepted at store.
            </p>
          )}
        </>
      )}

      <div className="mt-8">
        <h2 className="font-display text-lg text-navy">{t('scheme:installmentSchedule')}</h2>
        <p className="mt-1 text-sm text-muted">{t('scheme:installmentScheduleDesc')}</p>
        <div className="mt-4">
          <SchemeInstallmentTimeline
            installments={enrollment.scheme_installments}
            enrollment={enrollment}
            showPayButton
            onlinePaymentEnabled={onlinePaymentEnabled}
            onPay={setPayInstallment}
          />
        </div>
      </div>

      <SchemePayDialog
        open={!!payInstallment}
        onOpenChange={(open) => !open && setPayInstallment(null)}
        installment={payInstallment}
        onlinePaymentEnabled={onlinePaymentEnabled}
      />
    </div>
  )
}

export function SchemeEnrollmentDetailPage() {
  return (
    <RequireCustomer>
      <SchemeEnrollmentDetailContent />
    </RequireCustomer>
  )
}
