import { describe, expect, it } from 'vitest'
import { resolveInvoiceStamp } from './orderInvoice'

describe('orderInvoice stamp', () => {
  it('marks paid orders as PAID (en)', () => {
    expect(resolveInvoiceStamp({ payment_status: 'paid' })).toEqual({
      label: 'PAID',
      tone: 'paid',
    })
  })

  it('marks paid orders as مدفوع (ar)', () => {
    expect(resolveInvoiceStamp({ payment_status: 'paid' }, 'ar')).toEqual({
      label: 'مدفوع',
      tone: 'paid',
    })
  })

  it('marks COD / unpaid as PAYMENT REQUIRED (en)', () => {
    expect(resolveInvoiceStamp({ payment_status: 'cod_pending', payment_method: 'cod' }).label)
      .toBe('PAYMENT REQUIRED')
    expect(resolveInvoiceStamp({ payment_status: 'pending', payment_method: 'manual' }).label)
      .toBe('PAYMENT REQUIRED')
  })

  it('marks unpaid as الدفع مطلوب (ar)', () => {
    expect(resolveInvoiceStamp({ payment_status: 'pending' }, 'ar').label)
      .toBe('الدفع مطلوب')
  })
})
