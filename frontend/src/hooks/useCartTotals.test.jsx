import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useCartTotals } from '@/hooks/useCartTotals'

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
  },
}))

import { api } from '@/lib/api'

function wrap() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useCartTotals (authoritative quote)', () => {
  beforeEach(() => {
    api.post.mockReset()
  })

  it('uses backend quote totals without local VAT math', async () => {
    api.post.mockResolvedValue({
      lines: [
        {
          variant_id: 'v24',
          qty: 1,
          breakup: {
            purity: '24k',
            tax_treatment: 'zero_rated',
            vat_amount: 0,
            line_total: 900,
            unit_subtotal_before_vat: 900,
          },
        },
        {
          variant_id: 'v22',
          qty: 1,
          breakup: {
            purity: '22k',
            tax_treatment: 'standard',
            vat_amount: 50,
            line_total: 1050,
            unit_subtotal_before_vat: 1000,
          },
        },
      ],
      totals: {
        subtotal: 1900,
        discount_amount: 0,
        tax_amount: 50,
        shipping_fee: 25,
        total: 1975,
        standard_rated_total: 1000,
        zero_rated_total: 900,
        exempt_total: 0,
        tax_breakdown: {
          standard_rated_total: 1000,
          zero_rated_total: 900,
          exempt_total: 0,
          vat_total: 50,
        },
      },
      coupon: null,
    })

    const { result } = renderHook(
      () => useCartTotals([
        { id: 'c1', variant_id: 'v24', qty: 1 },
        { id: 'c2', variant_id: 'v22', qty: 1 },
      ], null),
      { wrapper: wrap() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(api.post).toHaveBeenCalledWith('/customer/cart/quote', {})
    expect(result.current.taxAmount).toBe(50)
    expect(result.current.total).toBe(1975)
    expect(result.current.taxBreakdown.zero_rated_total).toBe(900)
    expect(result.current.taxBreakdown.standard_rated_total).toBe(1000)
  })

  it('forwards coupon_code to quote endpoint', async () => {
    api.post.mockResolvedValue({
      lines: [],
      totals: {
        subtotal: 100,
        discount_amount: 10,
        tax_amount: 0,
        shipping_fee: 0,
        total: 90,
        tax_breakdown: { vat_total: 0, zero_rated_total: 100, standard_rated_total: 0, exempt_total: 0 },
      },
      coupon: { code: 'SAVE10', discount_amount: 10 },
    })

    const { result } = renderHook(
      () => useCartTotals([{ id: 'c1', variant_id: 'v1', qty: 1 }], 'SAVE10'),
      { wrapper: wrap() },
    )

    await waitFor(() => expect(result.current.discount).toBe(10))
    expect(api.post).toHaveBeenCalledWith('/customer/cart/quote', { coupon_code: 'SAVE10' })
    expect(result.current.coupon.discount_amount).toBe(10)
  })

  it('exposes quote error and null total (never treats AED 0 as valid on failure)', async () => {
    api.post.mockRejectedValue(new Error('quote failed'))
    const { result } = renderHook(
      () => useCartTotals([{ id: 'c1', variant_id: 'v1', qty: 1 }], null),
      { wrapper: wrap() },
    )
    await waitFor(() => expect(result.current.error).toBeTruthy())
    expect(result.current.total).toBeNull()
    expect(typeof result.current.refetch).toBe('function')
  })
})
