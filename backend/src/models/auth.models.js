import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const customerSchema = new Schema({
  phone: { type: String, trim: true, unique: true, sparse: true },
  email: { type: String, trim: true, lowercase: true, sparse: true },
  fullName: { type: String, trim: true },
  avatarUrl: String,
  authProvider: { type: String, enum: ['otp', 'google', 'apple', 'email'], default: 'otp' },
  isActive: { type: Boolean, default: true, index: true },
  tokenVersion: { type: Number, default: 0, select: false },
}, { timestamps: true })

const staffSchema = new Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['owner', 'manager', 'staff'], default: 'staff', index: true },
  isActive: { type: Boolean, default: true, index: true },
  tokenVersion: { type: Number, default: 0, select: false },
  lastLoginAt: Date,
}, { timestamps: true })

const otpCodeSchema = new Schema({
  phone: { type: String, required: true, index: true },
  codeHash: { type: String, required: true, select: false },
  purpose: { type: String, enum: ['login', 'phone_verify'], default: 'login' },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date, default: null },
  /** Set to phone while challenge is active; cleared on consume for unique active-OTP index. */
  activeChallengeKey: { type: String, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } })
otpCodeSchema.index(
  { activeChallengeKey: 1 },
  { unique: true, name: 'otpcodes_activeChallengeKey_unique', partialFilterExpression: { activeChallengeKey: { $type: 'string' } } },
)
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'otpcodes_expiresAt_ttl' })

const refreshSessionSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, required: true, index: true },
  actorType: { type: String, enum: ['customer', 'staff'], required: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  /** Actor tokenVersion at session creation; rotate rejects on mismatch. */
  tokenVersion: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  revokedAt: Date,
  userAgent: String,
  ip: String,
}, { timestamps: true })
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'refreshsessions_expiresAt_ttl' })

export const Customer = models.Customer || model('Customer', customerSchema)
export const Staff = models.Staff || model('Staff', staffSchema)
export const OtpCode = models.OtpCode || model('OtpCode', otpCodeSchema)
export const RefreshSession = models.RefreshSession || model('RefreshSession', refreshSessionSchema)
