import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const schemeSchema = new Schema({
  name: { type: String, required: true },
  nameAr: String,
  description: String,
  descriptionAr: String,
  monthlyAmount: { type: Number, min: 0.01, required: true },
  tenureMonths: { type: Number, min: 1, max: 120, default: 11 },
  bonusMonths: { type: Number, min: 0, max: 24, default: 0 },
  isActive: { type: Boolean, default: true },
  terms: String,
  termsAr: String,
}, { timestamps: true })

const installmentSchema = new Schema({
  installmentNumber: { type: Number, min: 1, required: true },
  amount: { type: Number, min: 0.01, required: true },
  dueDate: { type: Date, required: true },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'overdue', 'cancelled'], default: 'pending' },
  paymentMethod: { type: String, enum: ['cash', 'card', 'bank_transfer', null], default: null },
  paidAt: Date,
  invoiceNumber: String,
  recordedBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
  transactionRef: String,
  note: String,
}, { _id: true, timestamps: true })

const statusHistorySchema = new Schema({
  status: { type: String, required: true },
  note: String,
  reason: String,
  changedBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
  changedAt: { type: Date, default: Date.now },
}, { _id: false })

const enrollmentSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  schemeId: { type: Schema.Types.ObjectId, ref: 'Scheme', required: true },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  monthlyAmountSnapshot: { type: Number, required: true },
  tenureMonthsSnapshot: { type: Number, required: true },
  bonusMonthsSnapshot: { type: Number, default: 0 },
  totalPaid: { type: Number, min: 0, default: 0 },
  payoutAmount: { type: Number, min: 0 },
  startedAt: { type: Date, default: Date.now },
  /** Calendar maturity — completion only allowed on/after this Dubai calendar day. */
  maturityAt: { type: Date },
  completedAt: Date,
  cancelledAt: Date,
  completedBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
  cancelledBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
  cancellationReason: String,
  installments: { type: [installmentSchema], default: [] },
  statusHistory: { type: [statusHistorySchema], default: [] },
}, { timestamps: true })

enrollmentSchema.index({ customerId: 1, schemeId: 1, status: 1 })
/** One active enrollment per customer+scheme. Historical completed/cancelled rows may coexist. */
enrollmentSchema.index(
  { customerId: 1, schemeId: 1 },
  {
    unique: true,
    name: 'schemeenrollments_active_customer_scheme_unique',
    partialFilterExpression: { status: 'active' },
  },
)

/**
 * Transaction-reference uniqueness lock for bank_transfer/card installment payments.
 * Normalization: trim + uppercase (case-insensitive uniqueness).
 * Cash payments do not create rows. Do not use PaymentEvent as a lock collection.
 */
const schemePaymentReferenceSchema = new Schema({
  normalizedReference: { type: String, required: true },
  displayReference: { type: String, required: true },
  enrollmentId: { type: Schema.Types.ObjectId, ref: 'SchemeEnrollment', required: true },
  installmentId: { type: Schema.Types.ObjectId, required: true },
  paymentEventId: { type: Schema.Types.ObjectId, ref: 'PaymentEvent' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
}, { timestamps: { createdAt: true, updatedAt: false } })

schemePaymentReferenceSchema.index(
  { normalizedReference: 1 },
  { unique: true, name: 'schemepaymentreferences_normalizedReference_unique' },
)

export const Scheme = models.Scheme || model('Scheme', schemeSchema)
export const SchemeEnrollment = models.SchemeEnrollment || model('SchemeEnrollment', enrollmentSchema)
export const SchemePaymentReference = models.SchemePaymentReference
  || model('SchemePaymentReference', schemePaymentReferenceSchema)
