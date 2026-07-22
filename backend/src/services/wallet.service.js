import mongoose from 'mongoose'
import { WalletAccount, WalletTransaction } from '../models/commerce.models.js'
import { AppError } from '../utils/AppError.js'
import { roundMoney } from '../utils/money.js'

function isDuplicateKey(error) {
  return error?.code === 11000 || error?.cause?.code === 11000
}

async function ensureAccount(customerId, session) {
  const existing = await WalletAccount.findOne({ customerId }).session(session)
  if (existing) return existing
  try {
    const [created] = await WalletAccount.create([{ customerId, balance: 0 }], { session })
    return created
  } catch (error) {
    if (isDuplicateKey(error)) {
      // Session may be aborted; rethrow so the caller retries the whole transaction.
      throw error
    }
    throw error
  }
}

/**
 * Run wallet work inside an existing session, or open a dedicated transaction.
 * Mutations must never touch balance and ledger outside a session.
 */
async function withWalletTransaction(session, work) {
  if (session) return work(session)
  const owned = await mongoose.startSession()
  try {
    let result
    await owned.withTransaction(async () => {
      result = await work(owned)
    })
    return result
  } finally {
    await owned.endSession()
  }
}

async function resolveIdempotent(idempotencyKey, customerId) {
  const existing = await WalletTransaction.findOne({ idempotencyKey })
  if (!existing) return null
  const account = await WalletAccount.findOne({ customerId })
  return {
    alreadyApplied: true,
    transaction: existing,
    balance: roundMoney(account?.balance || 0),
  }
}

export async function balance(customerId, session = null) {
  const account = await WalletAccount.findOne({ customerId }).session(session)
  if (account) return roundMoney(account.balance || 0)
  if (session) return 0
  const [result] = await WalletTransaction.aggregate([
    { $match: { customerId: new mongoose.Types.ObjectId(customerId) } },
    { $group: { _id: null, balance: { $sum: '$amount' } } },
  ])
  return roundMoney(result?.balance || 0)
}

export const transactions = (customerId, limit = 100) => WalletTransaction
  .find({ customerId })
  .sort({ createdAt: -1 })
  .limit(Math.min(Number(limit) || 100, 500))

/**
 * Credit wallet (refund, payout, adjustment). Idempotent via idempotencyKey.
 * Requires a Mongo session from the caller, or opens one automatically.
 */
export async function credit({
  customerId,
  amount,
  type,
  referenceType,
  referenceId,
  idempotencyKey,
  note,
  createdBy,
}, { session } = {}) {
  const money = roundMoney(amount)
  if (!(money > 0) || !Number.isFinite(money)) throw new AppError(422, 'INVALID_WALLET_AMOUNT', 'Wallet credit amount must be a positive number')
  if (!idempotencyKey) throw new AppError(422, 'IDEMPOTENCY_REQUIRED', 'Wallet mutation requires an idempotency key')

  const run = async (activeSession) => {
    const prior = await WalletTransaction.findOne({ idempotencyKey }).session(activeSession)
    if (prior) {
      const account = await ensureAccount(customerId, activeSession)
      return { alreadyApplied: true, transaction: prior, balance: roundMoney(account.balance) }
    }

    await ensureAccount(customerId, activeSession)
    const account = await WalletAccount.findOneAndUpdate(
      { customerId },
      { $inc: { balance: money } },
      { new: true, upsert: true, session: activeSession },
    )
    const [transaction] = await WalletTransaction.create([{
      customerId,
      amount: money,
      type,
      referenceType,
      referenceId,
      idempotencyKey,
      note,
      createdBy,
    }], { session: activeSession })
    return { alreadyApplied: false, transaction, balance: roundMoney(account.balance) }
  }

  try {
    return await withWalletTransaction(session, run)
  } catch (error) {
    if (isDuplicateKey(error)) {
      // Never compensate inside an aborted caller session — rethrow for whole-txn retry.
      if (session) throw error
      const resolved = await resolveIdempotent(idempotencyKey, customerId)
      if (resolved) return resolved
    }
    throw error
  }
}

/**
 * Debit wallet (purchase reservation). Fails if balance would go negative.
 * Idempotent via idempotencyKey.
 */
export async function debit({
  customerId,
  amount,
  type = 'purchase',
  referenceType,
  referenceId,
  idempotencyKey,
  note,
  createdBy,
}, { session } = {}) {
  const money = roundMoney(amount)
  if (!(money > 0) || !Number.isFinite(money)) throw new AppError(422, 'INVALID_WALLET_AMOUNT', 'Wallet debit amount must be a positive number')
  if (!idempotencyKey) throw new AppError(422, 'IDEMPOTENCY_REQUIRED', 'Wallet mutation requires an idempotency key')

  const run = async (activeSession) => {
    const prior = await WalletTransaction.findOne({ idempotencyKey }).session(activeSession)
    if (prior) {
      return { alreadyApplied: true, transaction: prior, balance: await balance(customerId, activeSession) }
    }

    await ensureAccount(customerId, activeSession)
    const account = await WalletAccount.findOneAndUpdate(
      { customerId, balance: { $gte: money } },
      { $inc: { balance: -money } },
      { new: true, session: activeSession },
    )
    if (!account) throw new AppError(409, 'INSUFFICIENT_WALLET', 'Wallet balance is insufficient')

    const [transaction] = await WalletTransaction.create([{
      customerId,
      amount: -money,
      type,
      referenceType,
      referenceId,
      idempotencyKey,
      note,
      createdBy,
    }], { session: activeSession })
    return { alreadyApplied: false, transaction, balance: roundMoney(account.balance) }
  }

  try {
    return await withWalletTransaction(session, run)
  } catch (error) {
    if (isDuplicateKey(error)) {
      if (session) throw error
      const resolved = await resolveIdempotent(idempotencyKey, customerId)
      if (resolved) return resolved
    }
    throw error
  }
}
