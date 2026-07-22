import mongoose from 'mongoose'
const { Schema, model, models } = mongoose

const auditLogSchema = new Schema({ actorId: { type: Schema.Types.ObjectId, ref: 'Staff', index: true }, actorRole: String, action: { type: String, required: true, index: true }, entityType: { type: String, required: true }, entityId: Schema.Types.ObjectId, before: Schema.Types.Mixed, after: Schema.Types.Mixed, metadata: { type: Schema.Types.Mixed, default: {} }, requestId: String, ip: String }, { timestamps: { createdAt: true, updatedAt: false } })
auditLogSchema.index({ createdAt: -1 })

const counterSchema = new Schema({ key: { type: String, required: true, unique: true }, value: { type: Number, default: 0 } }, { timestamps: true })

export const AuditLog = models.AuditLog || model('AuditLog', auditLogSchema)
export const Counter = models.Counter || model('Counter', counterSchema)
