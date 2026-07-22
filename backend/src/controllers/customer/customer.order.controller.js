import * as orderService from '../../services/order.service.js'
import { ok } from '../../utils/apiResponse.js'
import { toCustomerOrderDto } from '../../utils/customerOrderDto.js'

export async function place(req, res) {
  const order = await orderService.placeOrder(req.auth.sub, req.validated?.body || req.body)
  const enriched = await orderService.getCustomerOrder(req.auth.sub, order.id)
  ok(res, toCustomerOrderDto(enriched.order, { returns: enriched.order.returns || [], displayImageByProductId: enriched.displayImageByProductId }), 201)
}

export async function list(req, res) {
  const { orders, displayImageByProductId, page, limit, total, pages } = await orderService.listCustomerOrders(req.auth.sub, req.query)
  ok(
    res,
    orders.map((order) => toCustomerOrderDto(order, { returns: order.returns || [], displayImageByProductId })),
    200,
    { page, limit, total, pages },
  )
}

export async function get(req, res) {
  const { order, displayImageByProductId } = await orderService.getCustomerOrder(req.auth.sub, req.params.id)
  ok(res, toCustomerOrderDto(order, { returns: order.returns || [], displayImageByProductId }))
}
