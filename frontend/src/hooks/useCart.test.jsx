import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCart } from './useCart.js'

const post = vi.fn()
const get = vi.fn()
const patch = vi.fn()
const del = vi.fn()

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args) => get(...args),
    post: (...args) => post(...args),
    patch: (...args) => patch(...args),
    delete: (...args) => del(...args),
  },
  ApiError: class ApiError extends Error {
    constructor(message, status, code, details) {
      super(message)
      this.status = status
      this.code = code
      this.details = details
    }
  },
}))

vi.mock('@/contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({ isAuthenticated: true }),
}))

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useCart add-to-cart payload', () => {
  beforeEach(() => {
    get.mockResolvedValue([])
    post.mockResolvedValue({ id: 'c1', qty: 1, customization_request: null })
    patch.mockResolvedValue({})
    del.mockResolvedValue(null)
  })

  it('sends variant_id, qty, and customization_request', async () => {
    const { result } = renderHook(() => useCart(), { wrapper: wrap() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await result.current.add({
      variantId: 'var-1',
      qty: 2,
      customizationRequest: 'Engrave Aisha',
    })

    expect(post).toHaveBeenCalledWith('/customer/cart', {
      variant_id: 'var-1',
      qty: 2,
      customization_request: 'Engrave Aisha',
    })
  })

  it('sends null customization_request when omitted', async () => {
    const { result } = renderHook(() => useCart(), { wrapper: wrap() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await result.current.add({ variantId: 'var-2', qty: 1 })

    expect(post).toHaveBeenCalledWith('/customer/cart', {
      variant_id: 'var-2',
      qty: 1,
      customization_request: null,
    })
  })
})
