import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ENROLLMENT_STATUS,
  INSTALLMENT_STATUS,
  formatSchemeDate,
  getNextDueInstallment,
  schemeProgress,
  totalPaidAmount,
  totalRemainingAmount,
} from '@/lib/schemeUtils'
import {
  getEnrollmentStatusLabel,
  getInstallmentStatusLabel,
  getSchemePaymentMethods,
} from '@/lib/i18nLabels'
import { formatINR } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import { InvoiceNumber } from '@/components/shared/InvoiceNumber'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'

export function SchemeInstallmentTimeline({
  installments = [],
  enrollment,
  onPay,
  showPayButton = false,
  onlinePaymentEnabled = true,
  adminActions,
}) {
  const { t } = useTranslation(['scheme', 'common'])
  const schemeMethods = getSchemePaymentMethods(t)

  const schemeMethodLabel = (method) =>
    schemeMethods.find((m) => m.value === method)?.label || method

  const unpaidInstallments = [...(installments || [])]
    .filter((inst) => ['pending', 'overdue'].includes(inst.payment_status))
    .sort((a, b) => Number(a.installment_number || 0) - Number(b.installment_number || 0))
  const nextPayableInstallmentId =
    enrollment?.next_due_installment?.id || unpaidInstallments[0]?.id

  return (
    <div className="space-y-2">
      {installments.map((inst) => {
        const statusMeta = INSTALLMENT_STATUS[inst.payment_status] || INSTALLMENT_STATUS.pending
        const canPay =
          showPayButton &&
          ['pending', 'overdue'].includes(inst.payment_status) &&
          enrollment?.status === 'active' &&
          onlinePaymentEnabled === true &&
          inst.id === nextPayableInstallmentId

        return (
          <div
            key={inst.id}
            className={cn(
              'rounded-2xl border p-4 sm:flex sm:items-center sm:justify-between sm:gap-4',
              inst.payment_status === 'paid'
                ? 'border-gold/15 bg-ivory-2/80'
                : inst.payment_status === 'overdue'
                  ? 'border-red-200 bg-red-50/50'
                  : 'border-gold/20 bg-ivory-2'
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-medium text-navy">
                    {t('scheme:installmentNumber', { number: inst.installment_number })}
                  </span>
                  <Badge variant={statusMeta.variant}>
                    {getInstallmentStatusLabel(inst.payment_status, t)}
                  </Badge>
                </div>
                <span className="shrink-0 font-display text-lg text-gold sm:hidden">
                  {formatINR(inst.amount)}
                </span>
              </div>

              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="min-w-0 text-sm text-muted">
                  {t('common:dueDate', { date: formatSchemeDate(inst.due_date) })}
                  {inst.payment_status === 'paid' && inst.paid_at && (
                    <>
                      {' · '}
                      {t('common:paidDate', { date: formatSchemeDate(inst.paid_at) })}
                    </>
                  )}
                </p>
                {(canPay && onPay) || adminActions?.(inst) ? (
                  <div className="flex shrink-0 items-center gap-2 sm:hidden">
                    {canPay && onPay && (
                      <Button size="sm" onClick={() => onPay(inst)}>
                        {t('scheme:payNow')}
                      </Button>
                    )}
                    {adminActions?.(inst)}
                  </div>
                ) : null}
              </div>

              {inst.payment_status === 'paid' && (
                <div className="mt-2 space-y-1">
                  {inst.invoice_number && (
                    <InvoiceNumber number={inst.invoice_number} compact />
                  )}
                  <p className="text-xs text-muted">
                    {schemeMethodLabel(inst.payment_method)}
                  </p>
                </div>
              )}
            </div>

            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <span className="font-display text-lg text-gold">{formatINR(inst.amount)}</span>
              {canPay && onPay && (
                <Button size="sm" onClick={() => onPay(inst)}>
                  {t('scheme:payNow')}
                </Button>
              )}
              {adminActions?.(inst)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function SchemeEnrollmentSummary({ enrollment }) {
  const { t } = useTranslation(['scheme', 'common'])
  const lang = useContentLang()

  if (!enrollment) return null

  const installments = enrollment.scheme_installments || []
  const nextDue = getNextDueInstallment(installments)
  const statusMeta = ENROLLMENT_STATUS[enrollment.status] || ENROLLMENT_STATUS.active
  const progress = schemeProgress(enrollment)
  const schemeName = enrollment.schemes
    ? pickField(enrollment.schemes, 'name', lang)
    : t('scheme:summaryFallbackName')
  const schemeDescription = enrollment.schemes
    ? pickField(enrollment.schemes, 'description', lang)
    : ''

  return (
    <div className="rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl text-navy">
              {schemeName}
            </h2>
            <Badge variant={statusMeta.variant}>
              {getEnrollmentStatusLabel(enrollment.status, t)}
            </Badge>
          </div>
          {schemeDescription && (
            <p className="mt-1 text-sm text-muted">{schemeDescription}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">{t('scheme:monthly')}</p>
          <p className="font-display text-2xl text-gold">{formatINR(enrollment.monthly_amount)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-muted">{t('scheme:started')}</p>
          <p className="font-medium text-navy">{formatSchemeDate(enrollment.start_date)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">{t('scheme:progress')}</p>
          <p className="font-medium text-navy">
            {t('scheme:progressPaid', {
              paid: enrollment.installments_paid,
              total: enrollment.tenure_months,
            })}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">{t('scheme:totalPaid')}</p>
          <p className="font-medium text-navy">{formatINR(totalPaidAmount(installments))}</p>
        </div>
        <div>
          <p className="text-xs text-muted">{t('scheme:remaining')}</p>
          <p className="font-medium text-navy">
            {formatINR(totalRemainingAmount(installments, enrollment))}
          </p>
        </div>
      </div>

      {nextDue && enrollment.status === 'active' && (
        <div className="mt-4 rounded-xl border border-gold/25 bg-gold/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold">{t('scheme:nextDue')}</p>
          <p className="mt-1 text-sm text-navy">
            {t('scheme:nextDueDetail', {
              number: nextDue.installment_number,
              amount: formatINR(nextDue.amount),
              date: formatSchemeDate(nextDue.due_date),
            })}
          </p>
        </div>
      )}

      {enrollment.status === 'active' && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-ivory-3">
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted">{t('scheme:percentComplete', { percent: progress })}</p>
        </div>
      )}
    </div>
  )
}
