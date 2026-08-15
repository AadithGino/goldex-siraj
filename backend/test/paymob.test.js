import { describe, expect, it } from 'vitest'
import crypto from 'node:crypto'
import {
  buildPaymobSpecialReference,
  getPaymobConfig,
  normalizePaymobCreatedAt,
  resolveGoldexOrderId,
} from '../src/services/paymob.service.js'

describe('paymob.service', () => {
  it('exposes paymob config shape', () => {
    const cfg = getPaymobConfig()
    expect(cfg).toMatchObject({
      enabled: expect.any(Boolean),
      isConfigured: expect.any(Boolean),
      currency: expect.any(String),
    })
  })

  it('resolves goldex order ids from unique Paymob special references', () => {
    const orderId = '6a8070c2bcfc45879dfc92c3'
    expect(resolveGoldexOrderId(orderId)).toBe(orderId)
    expect(resolveGoldexOrderId(`${orderId}_1712345678901`)).toBe(orderId)
    expect(resolveGoldexOrderId(`${orderId}-2`)).toBe(orderId)
    expect(resolveGoldexOrderId('not-an-id')).toBeNull()
    expect(buildPaymobSpecialReference(orderId)).toMatch(new RegExp(`^${orderId}_\\d+$`))
  })

  it('uses Paymob transaction field order for HMAC payload', () => {
    const obj = {
      amount_cents: 100,
      created_at: '2020-03-25T18:39:44.719228',
      currency: 'EGP',
      error_occured: false,
      has_parent_transaction: false,
      id: 2556706,
      integration_id: 6741,
      is_3d_secure: true,
      is_auth: false,
      is_capture: false,
      is_refunded: false,
      is_standalone_payment: true,
      is_voided: false,
      order: { id: 4778239 },
      owner: 4705,
      pending: false,
      source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' },
      success: true,
    }
    const payload = [
      obj.amount_cents,
      obj.created_at,
      obj.currency,
      obj.error_occured,
      obj.has_parent_transaction,
      obj.id,
      obj.integration_id,
      obj.is_3d_secure,
      obj.is_auth,
      obj.is_capture,
      obj.is_refunded,
      obj.is_standalone_payment,
      obj.is_voided,
      obj.order?.id,
      obj.owner,
      obj.pending,
      obj.source_data?.pan,
      obj.source_data?.sub_type,
      obj.source_data?.type,
      obj.success,
    ].map((value) => {
      if (value === null || value === undefined) return ''
      if (typeof value === 'boolean') return value ? 'true' : 'false'
      return String(value)
    }).join('')

    expect(payload).toBe('1002020-03-25T18:39:44.719228EGPfalsefalse25567066741truefalsefalsefalsetruefalse47782394705false2346MasterCardcardtrue')
    const digest = crypto.createHmac('sha512', 'test-secret').update(payload).digest('hex')
    expect(digest).toHaveLength(128)
  })

  it('normalizes Paymob redirect created_at timezone plus for HMAC', () => {
    expect(normalizePaymobCreatedAt('2024-06-25T15:16:25.910710 04:00'))
      .toBe('2024-06-25T15:16:25.910710+04:00')
    expect(normalizePaymobCreatedAt('2024-06-25T15:16:25.910710+04:00'))
      .toBe('2024-06-25T15:16:25.910710+04:00')
  })
})
