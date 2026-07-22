import { addMonths, isBefore, startOfDay } from 'date-fns'
import { formatDateSafe } from '@/lib/date'

export const SCHEME_PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer', description: 'Manually verified transfer' },
  { value: 'card', label: 'Card payment', description: 'Manually verified card payment' },
]

export const SCHEME_PAYMENT_METHODS_ADMIN = [
  ...SCHEME_PAYMENT_METHODS,
  { value: 'cash', label: 'Cash (in-store)', description: 'Paid at counter' },
]

export const INSTALLMENT_STATUS = {
  pending: { label: 'Due', variant: 'outline' },
  overdue: { label: 'Overdue', variant: 'destructive' },
  paid: { label: 'Paid', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
}

export const ENROLLMENT_STATUS = {
  active: { label: 'Active', variant: 'success' },
  completed: { label: 'Completed', variant: 'gold' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
}

export function paymentMethodLabel(method) {
  if (!method) return '—'
  const all = SCHEME_PAYMENT_METHODS_ADMIN
  return all.find((m) => m.value === method)?.label || method
}

export function computeDueDate(startDate, installmentNumber) {
  return addMonths(new Date(startDate), installmentNumber - 1)
}

export function getNextDueInstallment(installments = []) {
  const unpaid = installments
    .filter((i) => i.payment_status === 'pending' || i.payment_status === 'overdue')
    .sort((a, b) => a.installment_number - b.installment_number)
  return unpaid[0] || null
}

export function isInstallmentOverdue(installment) {
  if (!installment || installment.payment_status === 'paid') return false
  if (installment.payment_status === 'overdue') return true
  return isBefore(startOfDay(new Date(installment.due_date)), startOfDay(new Date()))
}

export function schemeProgress(enrollment) {
  if (!enrollment?.tenure_months) return 0
  return Math.round((enrollment.installments_paid / enrollment.tenure_months) * 100)
}

export function formatSchemeDate(date) {
  return formatDateSafe(date, 'dd MMM yyyy')
}

export function totalPaidAmount(installments = []) {
  return installments
    .filter((i) => i.payment_status === 'paid')
    .reduce((sum, i) => sum + Number(i.amount || 0), 0)
}

/** Toast copy after scheme completion wallet credit (from RPC `wallet` field). */
export { getSchemeWalletCreditMessage } from '@/lib/i18nLabels'

export function totalRemainingAmount(installments = [], enrollment) {
  const unpaid = installments.filter(
    (i) => i.payment_status === 'pending' || i.payment_status === 'overdue'
  )
  if (unpaid.length) {
    return unpaid.reduce((sum, i) => sum + Number(i.amount || 0), 0)
  }
  const remaining = (enrollment?.tenure_months || 0) - (enrollment?.installments_paid || 0)
  return remaining * Number(enrollment?.monthly_amount || 0)
}
