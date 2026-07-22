import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const get = vi.fn()
const getWithMeta = vi.fn()

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args) => get(...args),
    getWithMeta: (...args) => getWithMeta(...args),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({ isAuthenticated: true }),
}))

vi.mock('@/lib/orderAdapter', () => ({
  adaptOrder: (row) => row,
}))

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('frontend API contract smoke (getWithMeta)', () => {
  beforeEach(() => {
    get.mockReset()
    getWithMeta.mockReset()
  })

  it('useAdminOrders expects { data, meta } from getWithMeta', async () => {
    getWithMeta.mockResolvedValue({
      data: [{ id: 'o1', order_number: 'ORD-1' }],
      meta: { page: 1, limit: 25, total: 1, pages: 1 },
    })
    const { useAdminOrders } = await import('./useAdminOrders.js')
    const { result } = renderHook(() => useAdminOrders({ page: 1 }), { wrapper: wrap() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getWithMeta).toHaveBeenCalledWith('/admin/orders', expect.objectContaining({ page: 1, limit: 25 }))
    expect(result.current.data.orders).toHaveLength(1)
    expect(result.current.data.total).toBe(1)
  })

  it('useAdminInventoryVariants uses getWithMeta { data, meta } shape', async () => {
    getWithMeta.mockResolvedValue({
      data: [{ id: 'v1', sku: 'SKU', label: '16' }],
      meta: { page: 1, limit: 100, total: 1, pages: 1 },
    })
    const { useAdminInventoryVariants, useAdminAllVariants } = await import('./useAdminInventory.js')
    const { result } = renderHook(() => useAdminInventoryVariants({ page: 1, limit: 100 }), { wrapper: wrap() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getWithMeta).toHaveBeenCalledWith('/admin/inventory/variants', {
      page: 1,
      limit: 100,
      search: undefined,
      stock_state: undefined,
    })
    expect(result.current.data.data[0].sku).toBe('SKU')
    expect(result.current.data.meta.total).toBe(1)

    // Deprecated alias still returns paginated envelope
    getWithMeta.mockClear()
    getWithMeta.mockResolvedValue({
      data: [{ id: 'v2', sku: 'SKU2', label: '18' }],
      meta: { page: 1, limit: 100, total: 1, pages: 1 },
    })
    const deprecated = renderHook(() => useAdminAllVariants(), { wrapper: wrap() })
    await waitFor(() => expect(deprecated.result.current.isSuccess).toBe(true))
    expect(deprecated.result.current.data.data[0].sku).toBe('SKU2')
  })

  it('useCart uses api.get and keeps customization_request', async () => {
    get.mockResolvedValue([{ id: 'c1', qty: 1, customization_request: 'A' }])
    const { useCart } = await import('./useCart.js')
    const { result } = renderHook(() => useCart(), { wrapper: wrap() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(get).toHaveBeenCalledWith('/customer/cart')
    expect(result.current.items[0].customization_request).toBe('A')
  })
})
