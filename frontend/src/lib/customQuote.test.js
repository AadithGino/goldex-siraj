import { describe, expect, it } from 'vitest'
import { previewCustomQuote } from './customQuote'

describe('previewCustomQuote', () => {
  it('matches exclusive VAT jewellery math', () => {
    const quote = previewCustomQuote({
      weight: 10,
      rate: 200,
      makingType: 'percent',
      makingValue: 10,
      wastagePercent: 5,
      stoneCharge: 100,
      vatPercent: 5,
      taxMode: 'exclusive',
    })
    expect(quote.goldValue).toBe(2000)
    expect(quote.wastageAmount).toBe(100)
    expect(quote.makingCharge).toBe(200)
    expect(quote.subtotal).toBe(2400)
    expect(quote.vatAmount).toBe(120)
    expect(quote.total).toBe(2520)
  })
})
