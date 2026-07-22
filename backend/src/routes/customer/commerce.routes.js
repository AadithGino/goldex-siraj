import { Router } from 'express'
import * as controller from '../../controllers/customer/customer.commerce.controller.js'
import { authenticateCustomer } from '../../middlewares/auth.js'
import { validate } from '../../middlewares/validate.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { addressWriteSchema } from '../../validators/commerce.validators.js'
import {
  cartAddSchema,
  cartQuoteSchema,
  cartUpdateSchema,
  couponValidateSchema,
  wishlistAddSchema,
} from '../../validators/order.validators.js'

const router = Router()
router.get('/pricing/:variantId', asyncHandler(controller.price))
router.use(authenticateCustomer)
router.post('/coupons/validate', validate(couponValidateSchema), asyncHandler(controller.coupon))
router.get('/cart', asyncHandler(controller.cartList))
router.post('/cart/quote', validate(cartQuoteSchema), asyncHandler(controller.cartQuote))
router.post('/cart', validate(cartAddSchema), asyncHandler(controller.cartAdd))
router.patch('/cart/:id', validate(cartUpdateSchema), asyncHandler(controller.cartUpdate))
router.delete('/cart/:id', asyncHandler(controller.cartRemove))
router.delete('/cart', asyncHandler(controller.cartClear))
router.get('/wishlist', asyncHandler(controller.wishlistList))
router.post('/wishlist', validate(wishlistAddSchema), asyncHandler(controller.wishlistAdd))
router.delete('/wishlist/:productId', asyncHandler(controller.wishlistRemove))
router.get('/addresses', asyncHandler(controller.addressList))
router.post('/addresses', validate(addressWriteSchema), asyncHandler(controller.addressCreate))
router.patch('/addresses/:id', validate(addressWriteSchema), asyncHandler(controller.addressUpdate))
router.delete('/addresses/:id', asyncHandler(controller.addressRemove))
export default router
