import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const pendingUploadSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  kind: { type: String, enum: ['return'], default: 'return', index: true },
  key: { type: String, required: true },
  url: { type: String, required: true },
  mime: { type: String, required: true },
  status: { type: String, enum: ['pending', 'attached', 'expired'], default: 'pending', index: true },
  returnRequestId: { type: Schema.Types.ObjectId, ref: 'ReturnRequest', default: null },
  expiresAt: { type: Date, required: true },
}, { timestamps: true })

pendingUploadSchema.index({ customerId: 1, status: 1, createdAt: -1 })
pendingUploadSchema.index({ expiresAt: 1 }, { name: 'pendinguploads_expiresAt' })
pendingUploadSchema.index({ key: 1 }, { unique: true, name: 'pendinguploads_key_unique' })

export const PendingUpload = models.PendingUpload || model('PendingUpload', pendingUploadSchema)
