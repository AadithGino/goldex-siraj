import { describe, expect, it } from 'vitest'
import { adaptOrder, isEstimatedPricing, maskTransactionRef, orderDisplayTotal } from './orderAdapter.js'

describe('orderAdapter', () => {
  it('maps items to order_items and status_history to order_status_history', () => {
    const adapted = adaptOrder({
      id: 'o1',
      items: [{
        id: 'i1',
        product_name: 'Ring',
        sku: 'SKU-1',
        qty: 2,
        unit_price: 100,
        line_total: 200,
        image_url: 'https://cdn.example.com/a.jpg',
        customization_request: 'Forever',
      }],
      status_history: [{ status: 'placed', created_at: '2026-07-01T10:00:00.000Z' }],
      payment_collection: { transaction_ref: 'ABC123456789', amount: 200, note: 'secret' },
    })

    expect(adapted.order_items).toHaveLength(1)
    expect(adapted.order_items[0].product_name).toBe('Ring')
    expect(adapted.order_items[0].customization_request).toBe('Forever')
    expect(adapted.order_status_history[0].status).toBe('placed')
    expect(adapted.payment_collection.transaction_ref_masked).toBe('••••6789')
  })

  it('supports legacy order_items field names', () => {
    const adapted = adaptOrder({
      order_items: [{ productName: 'Legacy', qty: 1 }],
      order_status_history: [{ status: 'confirmed' }],
    })
    expect(adapted.order_items[0].product_name).toBe('Legacy')
    expect(adapted.order_status_history[0].status).toBe('confirmed')
  })

  it('computes display totals and estimated pricing', () => {
    expect(orderDisplayTotal({ final_total: 120, estimated_total: 110, total: 100 })).toBe(120)
    expect(orderDisplayTotal({ estimated_total: 110, total: 100 })).toBe(110)
    expect(isEstimatedPricing({ pricing_mode: 'cod_delivery', final_total: null, payment_status: 'cod_pending' })).toBe(true)
    expect(isEstimatedPricing({ pricing_mode: 'manual_locked', payment_status: 'paid', final_total: 120 })).toBe(false)
  })

  it('masks short refs safely', () => {
    expect(maskTransactionRef('AB')).toBe('••••')
  })
})
