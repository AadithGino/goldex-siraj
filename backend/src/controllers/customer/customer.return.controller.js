import * as returnService from '../../services/return.service.js'
import * as walletService from '../../services/wallet.service.js'
import { ok } from '../../utils/apiResponse.js'
import { serialize } from '../../utils/serialize.js'
export async function list(req, res) { ok(res, serialize(await returnService.listCustomerReturns(req.auth.sub))) }
export async function create(req, res) { ok(res, serialize(await returnService.requestReturn(req.auth.sub, req.body)), 201) }
export async function wallet(req, res) { ok(res, { balance: await walletService.balance(req.auth.sub) }) }
export async function walletTransactions(req, res) { ok(res, serialize(await walletService.transactions(req.auth.sub, req.query.limit))) }
