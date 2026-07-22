import { describe, expect, it } from 'vitest'
import {
  SchemePayloadError,
  toInstallmentPayPayload,
  toSchemeCompletePayload,
  toSchemePayload,
} from './schemePayload'

describe('toSchemePayload', () => {
  it('emits canonical snake_case fields', () => {
    expect(toSchemePayload({
      name: 'Gold Save',
      name_ar: 'ذهب',
      description: 'Plan',
      monthly_amount: '100.555',
      tenure_months: 11,
      bonus_months: 1,
      is_active: true,
    })).toEqual({
      name: 'Gold Save',
      name_ar: 'ذهب',
      description: 'Plan',
      description_ar: null,
      monthly_amount: 100.56,
      tenure_months: 11,
      bonus_months: 1,
      is_active: true,
    })
  })

  it('rejects fractional tenure and invalid amounts', () => {
    expect(() => toSchemePayload({
      name: 'X', monthly_amount: 10, tenure_months: 1.5, bonus_months: 0, is_active: true,
    })).toThrow(SchemePayloadError)
    expect(() => toSchemePayload({
      name: 'X', monthly_amount: 'abc', tenure_months: 11, bonus_months: 0, is_active: true,
    })).toThrow(/Monthly amount/)
  })
})

describe('toInstallmentPayPayload', () => {
  it('matches backend canonical contract', () => {
    expect(toInstallmentPayPayload({
      amount: 100,
      payment_method: 'cash',
      note: 'Received at counter',
    })).toEqual({
      amount: 100,
      payment_method: 'cash',
      transaction_ref: null,
      note: 'Received at counter',
    })
  })

  it('requires transaction_ref for bank/card and rejects wallet', () => {
    expect(() => toInstallmentPayPayload({
      amount: 100, payment_method: 'bank_transfer',
    })).toThrow(/reference/)
    expect(() => toInstallmentPayPayload({
      amount: 100, payment_method: 'wallet',
    })).toThrow(SchemePayloadError)
  })
})

describe('toSchemeCompletePayload', () => {
  it('never includes amount', () => {
    const payload = toSchemeCompletePayload({ note: 'Maturity verified', amount: 999 })
    expect(payload).toEqual({ note: 'Maturity verified' })
    expect(payload).not.toHaveProperty('amount')
  })
})
