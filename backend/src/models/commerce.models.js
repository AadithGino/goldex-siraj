import mongoose from 'mongoose'

const { Schema, model, models } = mongoose
const money = { type: Number, min: 0, default: 0 }

const cartItemSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  variantId: { type: Schema.Types.ObjectId, ref: 'Variant', required: true },
  qty: { type: Number, min: 1, required: true, default: 1 },
  priceSnapshot: Number,
  goldRateSnapshot: Number,
  /** Plain-text engraving / customization; null when none. */
  customizationRequest: { type: String, maxlength: 1000, default: null },
  /**
   * Stable identity for cart uniqueness with customization:
   * '' = no customization; otherwise sha256 hex of normalized text.
   * Same variant + different customization → separate cart lines.
   * Empty string is intentional (not "missing"); do not mark required —
   * Mongoose treats '' as failing `required: true`.
   */
  customizationKey: { type: String, default: '', maxlength: 64 },
}, { timestamps: { createdAt: 'addedAt', updatedAt: true } })
cartItemSchema.index(
  { customerId: 1, variantId: 1, customizationKey: 1 },
  { unique: true, name: 'cartitems_customer_variant_customization_unique' },
)

const wishlistItemSchema = new Schema({ customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true }, productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true } }, { timestamps: { createdAt: true, updatedAt: false } })
wishlistItemSchema.index({ customerId: 1, productId: 1 }, { unique: true, name: 'wishlistitems_customer_product_unique' })

const addressSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true }, label: { type: String, default: 'Home' }, recipientName: String, phone: String,
  line1: String, line2: String, city: String, state: String, pincode: String, country: { type: String, default: 'United Arab Emirates' }, latitude: Number, longitude: Number,
  isDefault: { type: Boolean, default: false },
}, { timestamps: true })

const couponSchema = new Schema({
  code: { type: String, required: true, uppercase: true, trim: true, unique: true }, discountType: { type: String, enum: ['percent', 'flat'], required: true },
  discountValue: { type: Number, min: 0.01, required: true }, minOrder: money, maxDiscount: { type: Number, min: 0.01 }, usageLimit: { type: Number, min: 1 }, usedCount: { type: Number, min: 0, default: 0 },
  perCustomerLimit: { type: Number, min: 1, default: 1 }, validFrom: { type: Date, default: Date.now }, validTo: Date, isActive: { type: Boolean, default: true },
}, { timestamps: true })

const orderItemSchema = new Schema({
  variantId: { type: Schema.Types.ObjectId, ref: 'Variant' },
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, required: true },
  productNameAr: String,
  productSlug: String,
  sku: String,
  imageUrl: String,
  metalType: String,
  metalColor: String,
  variantLabel: String,
  variantLabelAr: String,
  qty: { type: Number, min: 1, required: true },
  unitPrice: money,
  weightGrams: money,
  purity: String,
  effectiveWeight: money,
  makingCharge: money,
  stoneCharge: money,
  lineTotal: money,
  breakup: { type: Schema.Types.Mixed, default: {} },
  /** Immutable plain-text customization snapshot from the cart line at placement. */
  customizationRequest: { type: String, maxlength: 1000, default: null },
  /** Share of final paid total allocated to this line at payment time. */
  paidAllocation: { type: Number, min: 0, default: 0 },
  returnedQty: { type: Number, min: 0, default: 0 },
  /** Quantity reserved by open (requested/approved) return requests. */
  reservedReturnQty: { type: Number, min: 0, default: 0 },
  refundedAmount: { type: Number, min: 0, default: 0 },
}, { _id: true })

const couponSnapshotSchema = new Schema({
  couponId: { type: Schema.Types.ObjectId, ref: 'Coupon' },
  code: String,
  discountType: { type: String, enum: ['percent', 'flat'] },
  discountValue: Number,
  maxDiscount: Number,
  discountAmountAtPlacement: money,
}, { _id: false })

const paymentCollectionSchema = new Schema({
  amount: money,
  expectedAmount: money,
  currency: { type: String, default: 'AED' },
  collectedBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
  transactionRef: String,
  verifiedAt: Date,
  note: String,
}, { _id: false })

const orderSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  orderNumber: { type: String, required: true, unique: true },
  invoiceNumber: { type: String, unique: true, sparse: true },
  status: { type: String, enum: ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'partially_returned'], default: 'placed', index: true },
  paymentMethod: { type: String, enum: ['cod', 'manual'], default: 'cod' },
  paymentMode: { type: String, enum: ['cash', 'bank_transfer', 'card', null], default: null },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'cod_pending'], default: 'cod_pending', index: true },
  pricingMode: { type: String, enum: ['cod_delivery', 'manual_locked'], default: 'cod_delivery' },
  subtotal: money,
  makingChargeTotal: money,
  discountAmount: money,
  taxAmount: money,
  shippingFee: money,
  walletApplied: money,
  total: money,
  estimatedTotal: money,
  finalTotal: { type: Number, min: 0, default: null },
  amountDue: money,
  /** Cumulative wallet refunds issued for this order (cancellations/returns). */
  refundedTotal: money,
  /** Immutable VAT buckets from line snapshots at placement / handover. */
  taxBreakdown: {
    type: new Schema({
      standardRatedTotal: { type: Number, min: 0, default: 0 },
      zeroRatedTotal: { type: Number, min: 0, default: 0 },
      exemptTotal: { type: Number, min: 0, default: 0 },
      vatTotal: { type: Number, min: 0, default: 0 },
    }, { _id: false }),
    default: null,
  },
  couponCode: String,
  couponSnapshot: { type: couponSnapshotSchema, default: null },
  shipTo: { type: Schema.Types.Mixed, required: true },
  isGift: { type: Boolean, default: false },
  giftNote: String,
  items: { type: [orderItemSchema], default: [] },
  goldRateSnapshot: { type: Map, of: Number, default: {} },
  placedAt: { type: Date, default: Date.now, index: true },
  finalizedAt: Date,
  paidAt: Date,
  deliveredAt: Date,
  paymentCollection: { type: paymentCollectionSchema, default: null },
  statusHistory: [{ status: String, note: String, changedBy: { type: Schema.Types.ObjectId, ref: 'Staff' }, createdAt: { type: Date, default: Date.now } }],
  idempotencyKey: { type: String, required: true },
}, { timestamps: true, optimisticConcurrency: true })
orderSchema.index({ customerId: 1, idempotencyKey: 1 }, { unique: true, name: 'orders_customer_idempotency_unique' })
orderSchema.index({ paymentStatus: 1, paidAt: -1 })

const walletAccountSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true, index: true },
  balance: { type: Number, min: 0, default: 0 },
}, { timestamps: true, optimisticConcurrency: true })

const walletTransactionSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true }, amount: { type: Number, required: true },
  type: { type: String, enum: ['scheme_payout', 'purchase', 'refund', 'adjustment'], required: true }, referenceType: String, referenceId: Schema.Types.ObjectId,
  idempotencyKey: { type: String, unique: true, sparse: true }, note: String, createdBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
}, { timestamps: { createdAt: true, updatedAt: false } })

/** Tracks active redemptions per customer for atomic per-customer coupon limits. */
const couponCustomerUsageSchema = new Schema({
  couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  activeCount: { type: Number, min: 0, default: 0 },
}, { timestamps: true })
couponCustomerUsageSchema.index({ couponId: 1, customerId: 1 }, { unique: true, name: 'couponcustomerusages_coupon_customer_unique' })

const couponRedemptionSchema = new Schema({
  couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  discountAmount: money,
  status: { type: String, enum: ['active', 'rolled_back'], default: 'active', index: true },
  rolledBackAt: Date,
  rollbackReason: String,
  rolledBackBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
}, { timestamps: { createdAt: true, updatedAt: false } })
couponRedemptionSchema.index({ couponId: 1, orderId: 1 }, { unique: true, name: 'couponredemptions_coupon_order_unique' })
couponRedemptionSchema.index({ couponId: 1, status: 1, customerId: 1 })

const paymentEventSchema = new Schema({ orderId: { type: Schema.Types.ObjectId, ref: 'Order', index: true }, schemeInstallmentId: Schema.Types.ObjectId, provider: { type: String, required: true }, eventType: { type: String, required: true }, transactionId: { type: String, unique: true, sparse: true }, amount: money, currency: { type: String, default: 'AED' }, verified: { type: Boolean, default: false }, payload: { type: Schema.Types.Mixed, default: {} }, processedAt: Date, processingError: String }, { timestamps: { createdAt: true, updatedAt: false } })

const returnRequestSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  orderItemId: Schema.Types.ObjectId,
  /** Quantity requested for this line; null means full remaining qty (whole-order or legacy). */
  requestedQty: { type: Number, min: 1, default: null },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  kind: { type: String, enum: ['cancellation', 'return'], required: true },
  status: { type: String, enum: ['requested', 'approved', 'rejected', 'completed'], default: 'requested' },
  reason: String,
  proofUrls: { type: [String], default: [] },
  requestedAt: { type: Date, default: Date.now },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
  resolvedAt: Date,
  resolutionNote: String,
}, { timestamps: true })
returnRequestSchema.index({ orderId: 1, orderItemId: 1, status: 1 }, { name: 'returnrequests_order_item_status' })
returnRequestSchema.index(
  { orderId: 1 },
  {
    unique: true,
    name: 'returnrequests_active_cancellation_unique',
    partialFilterExpression: {
      kind: 'cancellation',
      status: { $in: ['requested', 'approved'] },
    },
  },
)
returnRequestSchema.index(
  { orderId: 1 },
  {
    unique: true,
    name: 'returnrequests_active_whole_order_return_unique',
    partialFilterExpression: {
      kind: 'return',
      orderItemId: null,
      status: { $in: ['requested', 'approved'] },
    },
  },
)

/** Per-order return coordination — serializes whole vs line vs cancellation paths. */
const returnCoordinationSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
  mode: {
    type: String,
    enum: ['idle', 'cancellation', 'whole_return', 'line_return'],
    default: 'idle',
  },
  generation: { type: Number, default: 0 },
  activeRequestCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true })
returnCoordinationSchema.index({ orderId: 1 }, { unique: true, name: 'returncoordination_orderId_unique' })

const reviewSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true }, customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true }, orderId: { type: Schema.Types.ObjectId, ref: 'Order' }, orderItemId: Schema.Types.ObjectId,
  rating: { type: Number, min: 1, max: 5, required: true }, title: String, comment: String, status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
}, { timestamps: true })
reviewSchema.index({ productId: 1, customerId: 1 }, { unique: true, name: 'reviews_product_customer_unique' })

export const CartItem = models.CartItem || model('CartItem', cartItemSchema)
export const WishlistItem = models.WishlistItem || model('WishlistItem', wishlistItemSchema)
export const Address = models.Address || model('Address', addressSchema)
export const Coupon = models.Coupon || model('Coupon', couponSchema)
export const Order = models.Order || model('Order', orderSchema)
export const WalletAccount = models.WalletAccount || model('WalletAccount', walletAccountSchema)
export const WalletTransaction = models.WalletTransaction || model('WalletTransaction', walletTransactionSchema)
export const CouponCustomerUsage = models.CouponCustomerUsage || model('CouponCustomerUsage', couponCustomerUsageSchema)
export const CouponRedemption = models.CouponRedemption || model('CouponRedemption', couponRedemptionSchema)
export const PaymentEvent = models.PaymentEvent || model('PaymentEvent', paymentEventSchema)
export const ReturnRequest = models.ReturnRequest || model('ReturnRequest', returnRequestSchema)
export const ReturnCoordination = models.ReturnCoordination || model('ReturnCoordination', returnCoordinationSchema)
export const Review = models.Review || model('Review', reviewSchema)
