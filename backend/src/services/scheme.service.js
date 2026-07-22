import mongoose from 'mongoose'
import { Counter } from '../models/audit.models.js'
import { PaymentEvent } from '../models/commerce.models.js'
import { Scheme, SchemeEnrollment, SchemePaymentReference } from '../models/scheme.models.js'
import { AppError } from '../utils/AppError.js'
import { addCalendarMonths } from '../utils/calendarMonths.js'
import { dubaiYmd } from '../utils/dubaiTime.js'
import { roundMoney } from '../utils/money.js'
import { paginationMeta, parsePagination } from '../utils/pagination.js'
import { deserialize } from '../utils/serialize.js'
import * as walletService from './wallet.service.js'
import {
  computeSchemePayout,
  displaySchemeTransactionRef,
  maskTransactionRef,
  normalizeSchemeTransactionRef,
  toInstallmentPayDto,
  toSchemeWriteDto,
} from './scheme.dto.js'

function computeMaturityAt(startedAt, tenureMonths) {
  return addCalendarMonths(startedAt, Number(tenureMonths || 0))
}

function maturityReached(maturityAt) {
  if (!maturityAt) return false
  return dubaiYmd() >= dubaiYmd(new Date(maturityAt))
}

function sumPaidInstallments(enrollment) {
  return roundMoney(
    (enrollment.installments || [])
      .filter((item) => item.paymentStatus === 'paid')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
  )
}

function pushStatusHistory(enrollment, { status, note, reason, changedBy }) {
  if (!Array.isArray(enrollment.statusHistory)) enrollment.statusHistory = []
  enrollment.statusHistory.push({
    status,
    note: note || null,
    reason: reason || null,
    changedBy: changedBy || null,
    changedAt: new Date(),
  })
}

function installmentEventKey(enrollmentId, installmentId) {
  return `scheme-inst:${enrollmentId}:${installmentId}`
}

function serializeInstallment(inst, { maskRef = false } = {}) {
  if (!inst) return null
  const ref = inst.transactionRef || null
  return {
    id: String(inst.id || inst._id),
    installment_number: inst.installmentNumber,
    amount: Number(inst.amount),
    due_date: inst.dueDate,
    payment_status: inst.paymentStatus,
    payment_method: inst.paymentMethod || null,
    paid_at: inst.paidAt || null,
    invoice_number: inst.invoiceNumber || null,
    transaction_ref: maskRef ? maskTransactionRef(ref) : ref,
    note: inst.note || null,
  }
}

function serializeEnrollment(enrollment, { maskRef = false } = {}) {
  if (!enrollment) return null
  const plain = typeof enrollment.toObject === 'function' ? enrollment.toObject({ virtuals: true }) : enrollment
  const scheme = plain.schemeId && typeof plain.schemeId === 'object' && plain.schemeId._id
    ? plain.schemeId
    : null
  const customer = plain.customerId && typeof plain.customerId === 'object' && plain.customerId._id
    ? plain.customerId
    : null

  return {
    id: String(plain._id || plain.id),
    status: plain.status,
    scheme_id: scheme
      ? {
        id: String(scheme._id),
        name: scheme.name,
        name_ar: scheme.nameAr || null,
        monthly_amount: scheme.monthlyAmount,
        tenure_months: scheme.tenureMonths,
        bonus_months: scheme.bonusMonths,
      }
      : String(plain.schemeId),
    customer_id: customer
      ? {
        id: String(customer._id),
        full_name: customer.fullName || null,
        phone: customer.phone || null,
        email: customer.email || null,
      }
      : String(plain.customerId),
    monthly_amount_snapshot: plain.monthlyAmountSnapshot,
    tenure_months_snapshot: plain.tenureMonthsSnapshot,
    bonus_months_snapshot: plain.bonusMonthsSnapshot,
    total_paid: plain.totalPaid,
    payout_amount: plain.payoutAmount ?? null,
    started_at: plain.startedAt,
    maturity_at: plain.maturityAt,
    completed_at: plain.completedAt || null,
    cancelled_at: plain.cancelledAt || null,
    completed_by: plain.completedBy ? String(plain.completedBy) : null,
    cancelled_by: plain.cancelledBy ? String(plain.cancelledBy) : null,
    cancellation_reason: plain.cancellationReason || null,
    installments: (plain.installments || []).map((row) => serializeInstallment(row, { maskRef })),
    status_history: (plain.statusHistory || []).map((row) => ({
      status: row.status,
      note: row.note || null,
      reason: row.reason || null,
      changed_by: row.changedBy ? String(row.changedBy) : null,
      changed_at: row.changedAt || null,
    })),
  }
}

function buildPaymentResult(enrollment, installment, {
  idempotent = false,
  paymentMethod,
  transactionRef,
} = {}) {
  return {
    enrollment: serializeEnrollment(enrollment),
    installment: serializeInstallment(installment),
    invoice_number: installment.invoiceNumber || null,
    payment_method: paymentMethod || installment.paymentMethod || null,
    transaction_ref: transactionRef ?? installment.transactionRef ?? null,
    paid_at: installment.paidAt || null,
    amount: Number(installment.amount),
    idempotent: Boolean(idempotent),
  }
}

/** Mark pending installments overdue using Asia/Dubai calendar date. */
export function applyOverdueStatuses(enrollment, asOf = new Date()) {
  const today = dubaiYmd(asOf)
  for (const installment of enrollment.installments || []) {
    if (installment.paymentStatus !== 'pending') continue
    if (dubaiYmd(new Date(installment.dueDate)) < today) {
      installment.paymentStatus = 'overdue'
    }
  }
  return enrollment
}

export async function listSchemes(admin = false, query = {}) {
  const mapped = deserialize(query || {})
  const filter = admin ? {} : { isActive: true }
  if (mapped.search) {
    const re = new RegExp(String(mapped.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [{ name: re }, { nameAr: re }]
  }
  if (mapped.isActive === true || mapped.is_active === true || mapped.status === 'active') {
    filter.isActive = true
  } else if (mapped.isActive === false || mapped.is_active === false || mapped.status === 'inactive') {
    filter.isActive = false
  }
  const { page, limit, skip } = parsePagination(mapped, { defaultLimit: 25, maxLimit: 100 })
  const [items, total] = await Promise.all([
    Scheme.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Scheme.countDocuments(filter),
  ])
  return { items, ...paginationMeta(page, limit, total) }
}

export async function listCustomerEnrollments(customerId, query = {}) {
  const mapped = deserialize(query || {})
  const filter = { customerId }
  if (mapped.status && mapped.status !== 'all' && mapped.status !== '') {
    filter.status = mapped.status
  }
  const { page, limit, skip } = parsePagination(mapped, { defaultLimit: 25, maxLimit: 100 })
  const [rows, total] = await Promise.all([
    SchemeEnrollment.find(filter).populate('schemeId').sort({ createdAt: -1 }).skip(skip).limit(limit),
    SchemeEnrollment.countDocuments(filter),
  ])
  rows.forEach((row) => applyOverdueStatuses(row))
  return {
    items: rows.map((row) => serializeEnrollment(row, { maskRef: true })),
    ...paginationMeta(page, limit, total),
  }
}

export async function listEnrollments(query = {}) {
  const mapped = deserialize(query || {})
  const filter = {}
  if (mapped.status && mapped.status !== 'all' && mapped.status !== '') {
    filter.status = mapped.status
  }
  if (mapped.search) {
    const { Customer } = await import('../models/auth.models.js')
    const re = new RegExp(String(mapped.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const [customers, schemes] = await Promise.all([
      Customer.find({ $or: [{ fullName: re }, { phone: re }, { email: re }] }).select('_id').lean(),
      Scheme.find({ $or: [{ name: re }, { nameAr: re }] }).select('_id').lean(),
    ])
    filter.$or = [
      { customerId: { $in: customers.map((row) => row._id) } },
      { schemeId: { $in: schemes.map((row) => row._id) } },
    ]
  }
  const { page, limit, skip } = parsePagination(mapped, { defaultLimit: 25, maxLimit: 100 })
  const [rows, total] = await Promise.all([
    SchemeEnrollment.find(filter)
      .populate('schemeId')
      .populate('customerId', 'fullName phone email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    SchemeEnrollment.countDocuments(filter),
  ])
  rows.forEach((row) => applyOverdueStatuses(row))
  return {
    items: rows.map((row) => serializeEnrollment(row)),
    ...paginationMeta(page, limit, total),
  }
}

export async function getEnrollmentForAdmin(id) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found')
  const enrollment = await SchemeEnrollment.findById(id)
    .populate('schemeId')
    .populate('customerId', 'fullName phone email')
  if (!enrollment) throw new AppError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found')
  applyOverdueStatuses(enrollment)
  return serializeEnrollment(enrollment)
}

export async function getEnrollmentForCustomer(customerId, id) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found')
  const enrollment = await SchemeEnrollment.findOne({ _id: id, customerId }).populate('schemeId')
  if (!enrollment) throw new AppError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found')
  applyOverdueStatuses(enrollment)
  return serializeEnrollment(enrollment, { maskRef: true })
}

export async function enroll(customerId, schemeId) {
  if (!mongoose.isValidObjectId(schemeId)) throw new AppError(404, 'SCHEME_NOT_FOUND', 'Scheme not found')
  const scheme = await Scheme.findOne({ _id: schemeId, isActive: true })
  if (!scheme) throw new AppError(404, 'SCHEME_NOT_FOUND', 'Scheme not found')

  const startedAt = new Date()
  const installments = Array.from({ length: scheme.tenureMonths }, (_, index) => ({
    installmentNumber: index + 1,
    amount: roundMoney(scheme.monthlyAmount),
    dueDate: addCalendarMonths(startedAt, index),
  }))

  try {
    const [enrollment] = await SchemeEnrollment.create([{
      customerId,
      schemeId,
      monthlyAmountSnapshot: roundMoney(scheme.monthlyAmount),
      tenureMonthsSnapshot: scheme.tenureMonths,
      bonusMonthsSnapshot: scheme.bonusMonths || 0,
      startedAt,
      maturityAt: computeMaturityAt(startedAt, scheme.tenureMonths),
      installments,
      statusHistory: [{
        status: 'active',
        note: 'Enrolled',
        changedAt: startedAt,
      }],
    }])
    return enrollment
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError(409, 'ALREADY_ENROLLED', 'You already have an active enrollment in this scheme')
    }
    throw error
  }
}

export async function createScheme(payload) {
  const dto = toSchemeWriteDto(payload, { partial: false })
  return Scheme.create(dto)
}

export async function updateScheme(id, payload) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, 'SCHEME_NOT_FOUND', 'Scheme not found')
  const dto = toSchemeWriteDto(payload, { partial: true })
  const scheme = await Scheme.findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
  if (!scheme) throw new AppError(404, 'SCHEME_NOT_FOUND', 'Scheme not found')
  return scheme
}

async function loadPaidInstallmentResult(enrollmentId, installmentId, session) {
  const enrollment = await SchemeEnrollment.findById(enrollmentId).session(session)
  const installment = enrollment?.installments.id(installmentId)
  if (enrollment && installment?.paymentStatus === 'paid') {
    return { enrollment, installment }
  }
  return null
}

/**
 * Semantic idempotent replay: amount already validated against installment amount.
 * Note may differ and is ignored — never overwrite saved note/method/ref/invoice.
 */
function assertSemanticReplayOrConflict(installment, pay) {
  const savedMethod = installment.paymentMethod || null
  const savedRef = normalizeSchemeTransactionRef(installment.transactionRef)
  const reqRef = normalizeSchemeTransactionRef(pay.transactionRef)
  if (pay.paymentMethod !== savedMethod || savedRef !== reqRef) {
    throw new AppError(
      409,
      'IDEMPOTENCY_CONFLICT',
      'Installment is already paid with different payment details',
    )
  }
}

function buildIdempotentPaymentResult(enrollment, installment) {
  return buildPaymentResult(enrollment, installment, {
    idempotent: true,
    paymentMethod: installment.paymentMethod,
    transactionRef: installment.transactionRef,
  })
}

async function assertTransactionRefAvailable({
  enrollment,
  installment,
  displayRef,
  normalizedRef,
  session,
}) {
  if (!normalizedRef) return

  const lock = await SchemePaymentReference.findOne({ normalizedReference: normalizedRef })
    .session(session)
    .select('_id enrollmentId installmentId')
  if (lock && String(lock.installmentId) !== String(installment._id)) {
    throw new AppError(409, 'SCHEME_TXN_REF_REUSED', 'transaction_ref was already used for another installment')
  }

  // Legacy Phase 22.6 lock events — read only, never create more.
  const legacy = await PaymentEvent.findOne({
    eventType: 'scheme_installment_ref',
    $or: [
      { transactionId: `scheme-ref:${normalizedRef}` },
      { transactionId: `scheme-ref:${displayRef}` },
    ],
  }).session(session).select('_id schemeInstallmentId')
  if (legacy && String(legacy.schemeInstallmentId) !== String(installment._id)) {
    throw new AppError(409, 'SCHEME_TXN_REF_REUSED', 'transaction_ref was already used for another installment')
  }

  const otherEnrollments = await SchemeEnrollment.find({
    _id: { $ne: enrollment._id },
    'installments.paymentStatus': 'paid',
    'installments.transactionRef': { $exists: true, $nin: [null, ''] },
  }).session(session).select('installments')
  for (const other of otherEnrollments) {
    const clash = other.installments.some(
      (row) => row.paymentStatus === 'paid'
        && normalizeSchemeTransactionRef(row.transactionRef) === normalizedRef,
    )
    if (clash) {
      throw new AppError(409, 'SCHEME_TXN_REF_REUSED', 'transaction_ref was already used for another installment')
    }
  }

  const reusedSame = enrollment.installments.some(
    (row) => row.paymentStatus === 'paid'
      && normalizeSchemeTransactionRef(row.transactionRef) === normalizedRef
      && String(row.id) !== String(installment.id),
  )
  if (reusedSame) {
    throw new AppError(409, 'SCHEME_TXN_REF_REUSED', 'transaction_ref was already used for another installment')
  }
}

export async function recordInstallment(enrollmentId, installmentId, input, staffId) {
  const pay = toInstallmentPayDto(input)
  if (!mongoose.isValidObjectId(enrollmentId) || !mongoose.isValidObjectId(installmentId)) {
    throw new AppError(404, 'INSTALLMENT_NOT_FOUND', 'Installment not found')
  }
  const session = await mongoose.startSession()
  try {
    return await session.withTransaction(async () => {
      const enrollment = await SchemeEnrollment.findById(enrollmentId).session(session)
      if (!enrollment || enrollment.status !== 'active') {
        throw new AppError(409, 'ENROLLMENT_INACTIVE', 'Enrollment is not active')
      }
      applyOverdueStatuses(enrollment)
      const installment = enrollment.installments.id(installmentId)
      if (!installment) throw new AppError(404, 'INSTALLMENT_NOT_FOUND', 'Installment not found')

      if (roundMoney(pay.amount) !== roundMoney(installment.amount)) {
        throw new AppError(
          409,
          'INSTALLMENT_AMOUNT_MISMATCH',
          'Submitted amount does not match the installment amount',
          { expected: roundMoney(installment.amount), submitted: roundMoney(pay.amount) },
        )
      }

      if (installment.paymentStatus === 'paid') {
        assertSemanticReplayOrConflict(installment, pay)
        return buildIdempotentPaymentResult(enrollment, installment)
      }
      if (installment.paymentStatus === 'cancelled') {
        throw new AppError(409, 'INSTALLMENT_CANCELLED', 'Cancelled installments cannot be paid')
      }

      const eventKey = installmentEventKey(enrollment.id, installment.id)
      const existingEvent = await PaymentEvent.findOne({ transactionId: eventKey }).session(session)
      if (existingEvent) {
        const paid = await loadPaidInstallmentResult(enrollmentId, installmentId, session)
        if (paid) {
          assertSemanticReplayOrConflict(paid.installment, pay)
          return buildIdempotentPaymentResult(paid.enrollment, paid.installment)
        }
        throw new AppError(409, 'INSTALLMENT_ALREADY_PAID', 'Installment payment already recorded')
      }

      const displayRef = displaySchemeTransactionRef(pay.transactionRef)
      const normalizedRef = normalizeSchemeTransactionRef(displayRef)
      await assertTransactionRefAvailable({
        enrollment,
        installment,
        displayRef,
        normalizedRef,
        session,
      })

      const paidAt = new Date()
      // Atomic consume-once claim — concurrent payers: exactly one matched update.
      const claimed = await SchemeEnrollment.findOneAndUpdate(
        {
          _id: enrollment._id,
          status: 'active',
          installments: {
            $elemMatch: {
              _id: installment._id,
              paymentStatus: { $in: ['pending', 'overdue'] },
            },
          },
        },
        {
          $set: {
            'installments.$.paymentStatus': 'paid',
            'installments.$.paymentMethod': pay.paymentMethod,
            'installments.$.transactionRef': displayRef,
            'installments.$.note': pay.note,
            'installments.$.paidAt': paidAt,
            'installments.$.recordedBy': staffId,
          },
        },
        { new: true, session },
      )

      if (!claimed) {
        const paid = await loadPaidInstallmentResult(enrollmentId, installmentId, session)
        if (paid) {
          assertSemanticReplayOrConflict(paid.installment, pay)
          return buildIdempotentPaymentResult(paid.enrollment, paid.installment)
        }
        throw new AppError(409, 'INSTALLMENT_ALREADY_PAID', 'Installment payment already recorded')
      }

      const counter = await Counter.findOneAndUpdate(
        { key: `scheme-invoice-${paidAt.getUTCFullYear()}` },
        { $inc: { value: 1 } },
        { upsert: true, new: true, session },
      )
      const invoiceNumber = `SCH-${paidAt.getUTCFullYear()}-${String(counter.value).padStart(6, '0')}`
      const paidInstallment = claimed.installments.id(installmentId)
      paidInstallment.invoiceNumber = invoiceNumber
      claimed.totalPaid = sumPaidInstallments(claimed)

      let paymentEvent
      try {
        ;[paymentEvent] = await PaymentEvent.create([{
          schemeInstallmentId: paidInstallment.id,
          provider: 'manual',
          eventType: 'scheme_installment_paid',
          transactionId: eventKey,
          amount: paidInstallment.amount,
          verified: true,
          payload: {
            payment_method: pay.paymentMethod,
            transaction_ref: displayRef,
            note: pay.note,
            enrollment_id: String(claimed.id),
            recorded_by: staffId,
            invoice_number: invoiceNumber,
          },
          processedAt: paidAt,
        }], { session })
      } catch (error) {
        if (error?.code === 11000) {
          const paid = await loadPaidInstallmentResult(enrollmentId, installmentId, session)
          if (paid) {
            assertSemanticReplayOrConflict(paid.installment, pay)
            return buildIdempotentPaymentResult(paid.enrollment, paid.installment)
          }
          throw new AppError(409, 'INSTALLMENT_ALREADY_PAID', 'Installment payment already recorded')
        }
        throw error
      }

      // Bank/card only — dedicated lock collection (exactly one PaymentEvent per installment).
      if (normalizedRef && (pay.paymentMethod === 'bank_transfer' || pay.paymentMethod === 'card')) {
        try {
          await SchemePaymentReference.create([{
            normalizedReference: normalizedRef,
            displayReference: displayRef,
            enrollmentId: claimed._id,
            installmentId: paidInstallment._id,
            paymentEventId: paymentEvent?._id,
            createdBy: staffId,
          }], { session })
        } catch (error) {
          if (error?.code === 11000) {
            throw new AppError(409, 'SCHEME_TXN_REF_REUSED', 'transaction_ref was already used for another installment')
          }
          throw error
        }
      }

      await claimed.save({ session })
      return buildPaymentResult(claimed, paidInstallment, {
        paymentMethod: pay.paymentMethod,
        transactionRef: displayRef,
      })
    })
  } finally {
    await session.endSession()
  }
}

export async function recordInstallmentById(installmentId, input, staffId) {
  if (!mongoose.isValidObjectId(installmentId)) {
    throw new AppError(404, 'INSTALLMENT_NOT_FOUND', 'Installment not found')
  }
  const enrollment = await SchemeEnrollment.findOne({ 'installments._id': installmentId })
  if (!enrollment) throw new AppError(404, 'INSTALLMENT_NOT_FOUND', 'Installment not found')
  return recordInstallment(enrollment.id, installmentId, input, staffId)
}

/**
 * Manager/owner maturity completion: one wallet payout, idempotent.
 */
export async function completeEnrollment(enrollmentId, staffId, { note } = {}) {
  if (!mongoose.isValidObjectId(enrollmentId)) {
    throw new AppError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found')
  }
  const session = await mongoose.startSession()
  try {
    return await session.withTransaction(async () => {
      const enrollment = await SchemeEnrollment.findById(enrollmentId).session(session)
      if (!enrollment) throw new AppError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found')
      if (enrollment.status === 'completed') {
        return enrollment
      }
      if (enrollment.status !== 'active') {
        throw new AppError(409, 'ENROLLMENT_INACTIVE', 'Enrollment is not active')
      }

      const maturityAt = enrollment.maturityAt || computeMaturityAt(enrollment.startedAt, enrollment.tenureMonthsSnapshot)
      if (!enrollment.maturityAt) enrollment.maturityAt = maturityAt
      if (!maturityReached(maturityAt)) {
        throw new AppError(409, 'MATURITY_NOT_REACHED', 'Scheme cannot be completed before the maturity date')
      }

      const unpaid = enrollment.installments.filter((item) => item.paymentStatus !== 'paid')
      if (unpaid.length) {
        throw new AppError(409, 'INSTALLMENTS_UNPAID', 'All required installments must be paid before completion')
      }

      const payoutAmount = computeSchemePayout(enrollment)
      enrollment.status = 'completed'
      enrollment.completedAt = new Date()
      enrollment.completedBy = staffId
      enrollment.payoutAmount = payoutAmount
      pushStatusHistory(enrollment, {
        status: 'completed',
        note: note || 'Maturity completion confirmed',
        changedBy: staffId,
      })

      await walletService.credit({
        customerId: enrollment.customerId,
        amount: payoutAmount,
        type: 'scheme_payout',
        referenceType: 'scheme_enrollment',
        referenceId: enrollment.id,
        idempotencyKey: `scheme-payout:${enrollment.id}`,
        note: 'Scheme maturity completion credit',
        createdBy: staffId,
      }, { session })

      try {
        await PaymentEvent.create([{
          provider: 'wallet',
          eventType: 'scheme_payout',
          transactionId: `scheme-payout:${enrollment.id}`,
          amount: payoutAmount,
          verified: true,
          payload: { enrollment_id: enrollment.id, completed_by: staffId },
          processedAt: new Date(),
        }], { session })
      } catch (error) {
        if (error?.code !== 11000) throw error
      }

      await enrollment.save({ session })
      return enrollment
    })
  } finally {
    await session.endSession()
  }
}

export async function updateEnrollment(id, input, staffId) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found')
  const body = input || {}
  const unknown = Object.keys(body).filter((key) => !['status', 'reason'].includes(key))
  if (unknown.length) {
    throw new AppError(422, 'FORBIDDEN_FIELD', `${unknown[0]} cannot be set via this endpoint`)
  }
  if (body.status !== 'cancelled') {
    throw new AppError(422, 'INVALID_ENROLLMENT_UPDATE', 'Only cancellation is supported via this endpoint')
  }

  const session = await mongoose.startSession()
  try {
    return await session.withTransaction(async () => {
      const enrollment = await SchemeEnrollment.findById(id).session(session)
      if (!enrollment) throw new AppError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found')
      if (enrollment.status === 'completed') {
        throw new AppError(409, 'CANNOT_CANCEL_COMPLETED', 'Completed enrollments cannot be cancelled')
      }
      if (enrollment.status === 'cancelled') {
        return enrollment
      }

      enrollment.status = 'cancelled'
      enrollment.cancelledAt = new Date()
      enrollment.cancelledBy = staffId || null
      enrollment.cancellationReason = body.reason ? String(body.reason).trim().slice(0, 2000) : null
      for (const installment of enrollment.installments) {
        if (installment.paymentStatus === 'pending' || installment.paymentStatus === 'overdue') {
          installment.paymentStatus = 'cancelled'
        }
      }
      pushStatusHistory(enrollment, {
        status: 'cancelled',
        reason: enrollment.cancellationReason,
        note: enrollment.cancellationReason || 'Enrollment cancelled',
        changedBy: staffId,
      })
      await enrollment.save({ session })
      return enrollment
    })
  } finally {
    await session.endSession()
  }
}

export { serializeEnrollment, serializeInstallment, computeMaturityAt, maturityReached }
