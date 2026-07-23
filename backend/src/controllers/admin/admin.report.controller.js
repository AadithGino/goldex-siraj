import * as service from '../../services/report.service.js'
import { ok } from '../../utils/apiResponse.js'
export async function sales(req, res) { await ok(res, await service.salesReport(req.query)) }
export async function top(req, res) { await ok(res, await service.topProducts(req.query.limit, req.query.from, req.query.to)) }
export async function dashboard(_req, res) { await ok(res, await service.dashboard()) }
