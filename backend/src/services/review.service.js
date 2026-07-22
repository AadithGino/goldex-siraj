import mongoose from 'mongoose'
import { Product } from '../models/catalog.models.js'
import { Order, Review } from '../models/commerce.models.js'
import { AppError } from '../utils/AppError.js'

export const listPublic = (productId) => Review.find({ productId, status: 'approved' }).populate('customerId', 'fullName avatarUrl').sort({ createdAt: -1 })
export const listAdmin = (query = {}) => Review.find(query.status ? { status: query.status } : {}).populate('customerId productId').sort({ createdAt: -1 })
export const getMine = (customerId, productId) => Review.findOne({ customerId, productId })

export async function submit(customerId, input) {
  const selector = { customerId, paymentStatus: 'paid', status: 'delivered', 'items.productId': input.product_id }
  if (input.order_id) selector._id = input.order_id
  const order = await Order.findOne(selector).sort({ deliveredAt: -1 })
  if (!order) throw new AppError(409, 'VERIFIED_PURCHASE_REQUIRED', 'Only delivered purchases can be reviewed')
  const item = order.items.find((value) => String(value.productId) === String(input.product_id))
  return Review.findOneAndUpdate({ productId: input.product_id, customerId }, { $set: { orderId: order.id, orderItemId: item.id, rating: input.rating, title: input.title, comment: input.comment, status: 'pending' } }, { upsert: true, new: true, runValidators: true })
}

export async function moderate(id, status) {
  if (!['approved', 'rejected'].includes(status)) throw new AppError(422, 'INVALID_REVIEW_STATUS', 'Review status is invalid')
  const session = await mongoose.startSession()
  try { return await session.withTransaction(async () => {
    const review = await Review.findByIdAndUpdate(id, { $set: { status } }, { new: true, session })
    if (!review) throw new AppError(404, 'REVIEW_NOT_FOUND', 'Review not found')
    const [rating] = await Review.aggregate([{ $match: { productId: review.productId, status: 'approved' } }, { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]).session(session)
    await Product.updateOne({ _id: review.productId }, { $set: { ratingAvg: rating?.avg || 0, ratingCount: rating?.count || 0 } }, { session })
    return review
  }) } finally { await session.endSession() }
}
