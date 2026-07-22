import { afterEach, describe, expect, it, vi } from 'vitest'
import { Customer } from '../src/models/auth.models.js'
import { Order, ReturnRequest, Review } from '../src/models/commerce.models.js'
import { Variant } from '../src/models/catalog.models.js'
import { dashboard, salesReport, topProducts } from '../src/services/report.service.js'
import { AppError } from '../src/utils/AppError.js'
import { dubaiDayEndUtc, dubaiDayStartUtc, isYmd } from '../src/utils/dubaiTime.js'

describe('paid-only sales reporting (Asia/Dubai)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('filters reports by paid/partially_refunded/refunded using Dubai day bounds', async () => {
    const aggregate = vi.spyOn(Order, 'aggregate').mockResolvedValue([])
    const report = await salesReport({ from: '2026-07-01', to: '2026-07-31' })
    expect(report).toMatchObject({
      timezone: 'Asia/Dubai',
      gross_sales: 0,
      refund_total: 0,
      net_sales: 0,
      total_sales: 0,
      order_count: 0,
      by_day: [],
    })
    for (const [pipeline] of aggregate.mock.calls) {
      const match = pipeline[0].$match
      expect(match.paymentStatus.$in).toEqual(['paid', 'partially_refunded', 'refunded'])
      expect(match.paidAt.$gte.toISOString()).toBe(dubaiDayStartUtc('2026-07-01').toISOString())
      expect(match.paidAt.$lte.toISOString()).toBe(dubaiDayEndUtc('2026-07-31').toISOString())
      expect(match.placedAt).toBeUndefined()
      const group = pipeline.find((stage) => stage.$group)?._id
      if (group?.$dateToString) {
        expect(group.$dateToString.timezone).toBe('Asia/Dubai')
      }
    }
  })

  it('rejects inverted and impossible calendar dates', async () => {
    await expect(salesReport({ from: '2026-07-31', to: '2026-07-01' })).rejects.toMatchObject({
      code: 'INVALID_DATE_RANGE',
    })
    await expect(salesReport({ from: '2026-99-99', to: '2026-07-01' })).rejects.toMatchObject({
      code: 'INVALID_DATE',
    })
    await expect(salesReport({ from: '2026-02-30', to: '2026-02-30' })).rejects.toMatchObject({
      code: 'INVALID_DATE',
    })
    expect(isYmd('2026-02-29')).toBe(false)
    expect(isYmd('2024-02-29')).toBe(true)
    await expect(salesReport({ from: '2026-07-31', to: '2026-07-01' })).rejects.toBeInstanceOf(AppError)
  })

  it('exposes canonical top-product fields and passes date range', async () => {
    const aggregate = vi.spyOn(Order, 'aggregate').mockResolvedValue([
      { product_id: 'p1', product_name: 'Ring', qty_sold: 2, gross_revenue: 1200, refunded_amount: 200, revenue: 1000 },
    ])
    const rows = await topProducts(5, '2026-07-01', '2026-07-20')
    expect(rows[0]).toMatchObject({ qty_sold: 2, revenue: 1000, gross_revenue: 1200, refunded_amount: 200 })
    expect(rows[0].quantity).toBeUndefined()
    expect(rows[0].gross).toBeUndefined()
    const match = aggregate.mock.calls[0][0][0].$match
    expect(match.paymentStatus.$in).toContain('partially_refunded')
    expect(match.paidAt.$gte.toISOString()).toBe(dubaiDayStartUtc('2026-07-01').toISOString())
    expect(match.paidAt.$lte.toISOString()).toBe(dubaiDayEndUtc('2026-07-20').toISOString())
  })

  it('returns the dashboard contract the admin UI consumes', async () => {
    vi.spyOn(Order, 'aggregate')
      .mockResolvedValueOnce([{ revenue: 120.5, orders: 2 }])
      .mockResolvedValueOnce([{ revenue: 900, orders: 7 }])
      .mockResolvedValueOnce([{ _id: 'placed', count: 3 }, { _id: 'delivered', count: 1 }])
    vi.spyOn(Order, 'countDocuments').mockResolvedValue(4)
    vi.spyOn(Review, 'countDocuments').mockResolvedValue(5)
    vi.spyOn(ReturnRequest, 'countDocuments').mockResolvedValue(1)
    vi.spyOn(Variant, 'countDocuments').mockResolvedValue(6)
    vi.spyOn(Customer, 'countDocuments').mockResolvedValue(11)

    const data = await dashboard()
    expect(data).toEqual({
      timezone: 'Asia/Dubai',
      today_sales: 120.5,
      orders_today: 2,
      month_sales: 900,
      month_orders: 7,
      orders_by_status: { placed: 3, delivered: 1 },
      pending_orders: 4,
      pending_reviews: 5,
      pending_returns: 1,
      low_stock_count: 6,
      active_customer_count: 11,
    })
    expect(data.today_revenue).toBeUndefined()
    expect(data.customer_count).toBeUndefined()
  })

  it('normalizes daily rows with gross/refund/net and total_sales alias', async () => {
    vi.spyOn(Order, 'aggregate')
      .mockResolvedValueOnce([{ gross_sales: 100, refund_total: 50, net_sales: 50, order_count: 1 }])
      .mockResolvedValueOnce([{
        date: '2026-07-20',
        gross_sales: 100,
        refund_total: 50,
        net_sales: 50,
        total_sales: 50,
        order_count: 1,
      }])
    const report = await salesReport({ from: '2026-07-20', to: '2026-07-20' })
    expect(report.gross_sales).toBe(100)
    expect(report.refund_total).toBe(50)
    expect(report.net_sales).toBe(50)
    expect(report.total_sales).toBe(50)
    expect(report.by_day[0]).toEqual({
      date: '2026-07-20',
      gross_sales: 100,
      refund_total: 50,
      net_sales: 50,
      total_sales: 50,
      order_count: 1,
    })
  })

  it('caps refunds with min(max(refund,0), gross) and never negative net', async () => {
    const { normalizeRefundAmount } = await import('../src/services/report.service.js')
    expect(normalizeRefundAmount(-10, 100)).toBe(0)
    expect(normalizeRefundAmount(150, 100)).toBe(100)
    expect(normalizeRefundAmount(40, 100)).toBe(40)
    expect(normalizeRefundAmount(100, 100)).toBe(100)

    const aggregate = vi.spyOn(Order, 'aggregate').mockResolvedValue([])
    await salesReport({ from: '2026-07-01', to: '2026-07-01' })
    const group = aggregate.mock.calls[0][0].find((stage) => stage.$group && stage.$group.refund_total)
    expect(JSON.stringify(group.$group.refund_total)).toContain('$min')
    expect(JSON.stringify(group.$group.refund_total)).toContain('$max')
  })
})
