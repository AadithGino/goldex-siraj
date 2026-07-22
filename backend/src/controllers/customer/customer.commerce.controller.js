import * as customerService from '../../services/customer.service.js'
import * as pricingService from '../../services/pricing.service.js'
import { ok } from '../../utils/apiResponse.js'
import { serialize } from '../../utils/serialize.js'

export async function price(req, res) { ok(res, await pricingService.getPriceBreakup(req.params.variantId, req.query.qty)) }
export async function coupon(req, res) {
  const body = req.validated?.body || req.body
  ok(res, await pricingService.validateCoupon(body.code, body.order_total, req.auth.sub))
}
export async function cartList(req, res) { ok(res, serialize(await customerService.listCart(req.auth.sub))) }
export async function cartQuote(req, res) {
  ok(res, serialize(await pricingService.quoteCustomerCart(req.auth.sub, req.validated?.body ?? req.body)))
}
export async function cartAdd(req, res) {
  ok(res, serialize(await customerService.addCartItem(req.auth.sub, req.validated.body)), 201)
}
export async function cartUpdate(req, res) {
  ok(res, serialize(await customerService.updateCartItem(
    req.auth.sub,
    req.validated.params.id,
    req.validated.body,
  )))
}
export async function cartRemove(req, res) {
  await customerService.removeCartItem(req.auth.sub, req.validated?.params?.id ?? req.params.id)
  res.status(204).end()
}
export async function cartClear(req, res) { await customerService.clearCart(req.auth.sub); res.status(204).end() }
export async function wishlistList(req, res) { ok(res, serialize(await customerService.listWishlist(req.auth.sub))) }
export async function wishlistAdd(req, res) {
  const body = req.validated?.body || req.body
  ok(res, serialize(await customerService.addWishlist(req.auth.sub, body.product_id)), 201)
}
export async function wishlistRemove(req, res) { await customerService.removeWishlist(req.auth.sub, req.params.productId); res.status(204).end() }
export async function addressList(req, res) { ok(res, serialize(await customerService.listAddresses(req.auth.sub))) }
export async function addressCreate(req, res) { ok(res, serialize(await customerService.saveAddress(req.auth.sub, req.validated?.body || req.body)), 201) }
export async function addressUpdate(req, res) { ok(res, serialize(await customerService.saveAddress(req.auth.sub, req.validated?.body || req.body, req.params.id))) }
export async function addressRemove(req, res) { await customerService.removeAddress(req.auth.sub, req.params.id); res.status(204).end() }
