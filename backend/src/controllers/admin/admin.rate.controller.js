import * as rateService from '../../services/rate.service.js'
import { ok } from '../../utils/apiResponse.js'
import { serialize } from '../../utils/serialize.js'
export async function goldList(req, res) { await ok(res, serialize(await rateService.listGoldRates(req.query.current === 'true'))) }
export async function goldSet(req, res) { await ok(res, serialize(await rateService.setGoldRate(req.body, req.auth.sub)), 201) }
export async function stoneList(req, res) { await ok(res, serialize(await rateService.listStoneRates(req.query.current === 'true'))) }
export async function stoneSet(req, res) { await ok(res, serialize(await rateService.setStoneRate(req.body, req.auth.sub)), 201) }
export async function stoneDelete(req, res) { await rateService.deleteStoneRate(req.params.id); res.status(204).end() }
