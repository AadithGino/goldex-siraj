import { isDubaiBusinessDateReached } from '@/lib/dubaiTime'

function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function toDateValue(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function roundPercent(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function mapSchemeInstallment(row = {}) {
  return {
    ...row,
    amount: toNumber(row.amount),
  }
}

export function computeInstallmentsPaid(installments = []) {
  return installments.filter((inst) => inst.payment_status === 'paid').length
}

export function computeSchemeProgress(enrollment = {}, installments = [], now = new Date()) {
  const tenure = toNumber(
    enrollment.tenure_months_snapshot ?? enrollment.tenure_months,
    0
  )
  const paidCount = computeInstallmentsPaid(installments)
  const percentage = tenure > 0 ? roundPercent((paidCount / tenure) * 100) : 0
  const pendingCount = installments.filter(
    (inst) => inst.payment_status === 'pending' || inst.payment_status === 'overdue'
  ).length
  const totalPaid = installments
    .filter((inst) => inst.payment_status === 'paid')
    .reduce((sum, inst) => sum + toNumber(inst.amount), 0)

  const nextDueInstallment =
    installments
      .filter((inst) => inst.payment_status === 'pending' || inst.payment_status === 'overdue')
      .sort((a, b) => toNumber(a.installment_number) - toNumber(b.installment_number))[0] || null

  const finalDueDate = installments.reduce((max, inst) => {
    const dueDate = toDateValue(inst.due_date)
    if (!dueDate) return max
    if (!max) return dueDate
    return dueDate > max ? dueDate : max
  }, null)
  const maturityAt = toDateValue(enrollment.maturity_at) || finalDueDate
  const isMatured = isDubaiBusinessDateReached(maturityAt, now)

  return {
    paidCount,
    pendingCount,
    totalPaid,
    percentage,
    nextDueInstallment,
    finalDueDate: finalDueDate ? finalDueDate.toISOString() : null,
    isMatured,
  }
}

export function mapSchemeEnrollment(row = {}, installmentsInput = null) {
  const installmentsSource = installmentsInput || row.scheme_installments || []
  const installments = installmentsSource
    .map(mapSchemeInstallment)
    .sort((a, b) => toNumber(a.installment_number) - toNumber(b.installment_number))

  const startedAt = row.started_at ?? row.start_date ?? null
  const monthlyAmountSnapshot = toNumber(
    row.monthly_amount_snapshot ?? row.monthly_amount ?? row.schemes?.monthly_amount
  )
  const tenureMonthsSnapshot = toNumber(
    row.tenure_months_snapshot ?? row.tenure_months ?? row.schemes?.tenure_months
  )
  const bonusMonthsSnapshot = toNumber(
    row.bonus_months_snapshot ?? row.bonus_months ?? row.schemes?.bonus_months
  )

  const progress = computeSchemeProgress(
    {
      ...row,
      tenure_months_snapshot: tenureMonthsSnapshot,
    },
    installments
  )

  const totalPaid = toNumber(row.total_paid, progress.totalPaid)
  const canComplete =
    row.status === 'active' &&
    progress.paidCount >= tenureMonthsSnapshot &&
    progress.isMatured

  return {
    ...row,
    started_at: startedAt,
    monthly_amount_snapshot: monthlyAmountSnapshot,
    tenure_months_snapshot: tenureMonthsSnapshot,
    bonus_months_snapshot: bonusMonthsSnapshot,
    scheme_installments: installments,
    paid_installments_count: progress.paidCount,
    pending_installments_count: progress.pendingCount,
    total_paid: totalPaid,
    progress_percentage: progress.percentage,
    next_due_installment: progress.nextDueInstallment,
    final_due_date: progress.finalDueDate,
    is_matured: progress.isMatured,
    can_complete: canComplete,

    // UI compatibility aliases (never write these back to DB columns)
    start_date: startedAt,
    monthly_amount: monthlyAmountSnapshot,
    tenure_months: tenureMonthsSnapshot,
    installments_paid: progress.paidCount,
  }
}
