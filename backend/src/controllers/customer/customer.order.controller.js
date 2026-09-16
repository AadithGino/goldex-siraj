import * as orderService from '../../services/order.service.js'
import { ok } from '../../utils/apiResponse.js'
import { toCustomerOrderDto } from '../../utils/customerOrderDto.js'

export async function place(req, res) {
  const order = await orderService.placeOrder(req.auth.sub, req.validated?.body || req.body)
  const enriched = await orderService.getCustomerOrder(req.auth.sub, order.id)
  const dto = toCustomerOrderDto(enriched.order, { returns: enriched.order.returns || [], displayImageByProductId: enriched.displayImageByProductId })
  if (order.checkoutUrl) dto.checkout_url = order.checkoutUrl
  await ok(res, dto, 201)
}

export async function paymobCheckout(req, res) {
  const result = await orderService.createOnlineCheckoutForOrder(req.auth.sub, req.params.id)
  await ok(res, result)
}

export async function paymobConfirm(req, res) {
  const order = await orderService.confirmOnlineRedirectPayment(
    req.auth.sub,
    req.params.id,
    req.validated?.body || req.body || {},
  )
  const enriched = await orderService.getCustomerOrder(req.auth.sub, order.id)
  await ok(res, toCustomerOrderDto(enriched.order, {
    returns: enriched.order.returns || [],
    displayImageByProductId: enriched.displayImageByProductId,
  }))
}

export async function onlineCheckout(req, res) {
  const requestedProvider = req.validated?.body?.payment_provider || req.body?.payment_provider || null
  const result = await orderService.createOnlineCheckoutForOrder(req.auth.sub, req.params.id, requestedProvider)
  await ok(res, result)
}

export async function changePaymentMethod(req, res) {
  const input = req.validated?.body || req.body || {}
  const result = await orderService.changePendingPaymentMethod(req.auth.sub, req.params.id, input)
  const enriched = await orderService.getCustomerOrder(req.auth.sub, result.order.id)
  const dto = toCustomerOrderDto(enriched.order, {
    returns: enriched.order.returns || [],
    displayImageByProductId: enriched.displayImageByProductId,
  })
  if (result.checkout_url) dto.checkout_url = result.checkout_url
  await ok(res, dto)
}

export async function onlineConfirm(req, res) {
  const order = await orderService.confirmOnlineRedirectPayment(
    req.auth.sub,
    req.params.id,
    req.validated?.body || req.body || {},
  )
  const enriched = await orderService.getCustomerOrder(req.auth.sub, order.id)
  await ok(res, toCustomerOrderDto(enriched.order, {
    returns: enriched.order.returns || [],
    displayImageByProductId: enriched.displayImageByProductId,
  }))
}

export async function list(req, res) {
  const { orders, displayImageByProductId, page, limit, total, pages } = await orderService.listCustomerOrders(req.auth.sub, req.query)
  await ok(
    res,
    orders.map((order) => toCustomerOrderDto(order, { returns: order.returns || [], displayImageByProductId })),
    200,
    { page, limit, total, pages },
  )
}

export async function get(req, res) {
  const { order, displayImageByProductId } = await orderService.getCustomerOrder(req.auth.sub, req.params.id)
  await ok(res, toCustomerOrderDto(order, { returns: order.returns || [], displayImageByProductId }))
}
