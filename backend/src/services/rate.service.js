import mongoose from 'mongoose'
import { GoldRate, StoneRate } from '../models/rate.models.js'
import { AppError } from '../utils/AppError.js'
import { deserialize } from '../utils/serialize.js'

const createdByFields = 'fullName email role'

function rateListQuery(Model, currentOnly) {
  return Model.find(currentOnly ? { isCurrent: true } : {})
    .populate('createdBy', createdByFields)
    .sort({ effectiveAt: -1, createdAt: -1 })
}

export async function listGoldRates(currentOnly = false) {
  return rateListQuery(GoldRate, currentOnly)
}

export async function setGoldRate(payload, staffId) {
  const input = deserialize(payload)
  const session = await mongoose.startSession()
  try {
    return await session.withTransaction(async () => {
      await GoldRate.updateMany({ purity: input.purity, isCurrent: true }, { $set: { isCurrent: false } }, { session })
      const [rate] = await GoldRate.create([{ purity: input.purity, ratePerGram: input.ratePerGram, effectiveAt: input.effectiveAt || new Date(), isCurrent: true, createdBy: staffId }], { session })
      return await rate.populate('createdBy', createdByFields)
    })
  } finally { await session.endSession() }
}

export async function listStoneRates(currentOnly = false) {
  return rateListQuery(StoneRate, currentOnly)
}

export async function setStoneRate(payload, staffId) {
  const input = deserialize(payload)
  const selector = { stoneType: input.stoneType, grade: input.grade || null, unit: input.unit, isCurrent: true }
  const session = await mongoose.startSession()
  try {
    return await session.withTransaction(async () => {
      await StoneRate.updateMany(selector, { $set: { isCurrent: false } }, { session })
      const [rate] = await StoneRate.create([{ ...input, isCurrent: true, createdBy: staffId }], { session })
      return await rate.populate('createdBy', createdByFields)
    })
  } finally { await session.endSession() }
}

export async function deleteStoneRate(id) {
  const rate = await StoneRate.findById(id)
  if (!rate) throw new AppError(404, 'RATE_NOT_FOUND', 'Stone rate not found')
  if (rate.isCurrent) throw new AppError(409, 'CURRENT_RATE_REQUIRED', 'Set a replacement rate before deleting the current rate')
  await rate.deleteOne()
}
