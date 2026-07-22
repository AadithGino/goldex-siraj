import mongoose from 'mongoose'
const { Schema, model, models } = mongoose

const goldRateSchema = new Schema({ purity: { type: String, enum: ['14k', '18k', '21k', '22k', '24k'], required: true, index: true }, ratePerGram: { type: Number, min: 0.01, required: true }, effectiveAt: { type: Date, default: Date.now }, isCurrent: { type: Boolean, default: true, index: true }, createdBy: { type: Schema.Types.ObjectId, ref: 'Staff' } }, { timestamps: { createdAt: true, updatedAt: false } })
goldRateSchema.index({ purity: 1, isCurrent: 1 }, { unique: true, name: 'goldrates_current_unique', partialFilterExpression: { isCurrent: true } })
goldRateSchema.index({ purity: 1, effectiveAt: -1 })

const stoneRateSchema = new Schema({ stoneType: { type: String, required: true }, grade: String, unit: { type: String, enum: ['carat', 'piece'], required: true }, rate: { type: Number, min: 0.01, required: true }, effectiveAt: { type: Date, default: Date.now }, isCurrent: { type: Boolean, default: true }, createdBy: { type: Schema.Types.ObjectId, ref: 'Staff' } }, { timestamps: { createdAt: true, updatedAt: false } })
stoneRateSchema.index({ stoneType: 1, grade: 1, unit: 1, isCurrent: 1 }, { unique: true, name: 'stonerates_current_unique', partialFilterExpression: { isCurrent: true } })

const stockMovementSchema = new Schema({
  variantId: { type: Schema.Types.ObjectId, ref: 'Variant', required: true },
  delta: { type: Number, required: true },
  qtyBefore: { type: Number, required: true },
  qtyAfter: { type: Number, min: 0, required: true },
  reason: {
    type: String,
    enum: ['order_placed', 'order_cancelled', 'order_returned', 'admin_adjustment', 'stock_import', 'stock_correction'],
    required: true,
  },
  referenceType: String,
  referenceId: Schema.Types.ObjectId,
  idempotencyKey: { type: String },
  operationType: { type: String },
  requestHash: { type: String },
  note: String,
  createdBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
}, { timestamps: { createdAt: true, updatedAt: false } })
stockMovementSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    sparse: false,
    name: 'stockmovements_idempotency_unique',
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
)
stockMovementSchema.index({ variantId: 1 }, { name: 'stockmovements_variantId' })

export const GoldRate = models.GoldRate || model('GoldRate', goldRateSchema)
export const StoneRate = models.StoneRate || model('StoneRate', stoneRateSchema)
export const StockMovement = models.StockMovement || model('StockMovement', stockMovementSchema)
