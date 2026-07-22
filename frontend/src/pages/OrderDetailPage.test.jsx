import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import { OrderDetailPage } from './OrderDetailPage.jsx'
import { adaptOrder } from '@/lib/orderAdapter'

vi.mock('@/contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({ isAuthenticated: true }),
  RequireCustomer: ({ children }) => children,
}))

vi.mock('@/components/auth/RequireCustomer', () => ({
  RequireCustomer: ({ children }) => children,
}))

vi.mock('@/hooks/useOrders', () => ({
  useOrder: () => ({
    data: adaptOrder({
      id: 'ord1',
      order_number: 'ORD-2026-0000001',
      status: 'placed',
      placed_at: '2026-07-20T10:00:00.000Z',
      payment_method: 'manual',
      payment_status: 'pending',
      pricing_mode: 'manual_locked',
      subtotal: 400,
      making_charge_total: 40,
      discount_amount: 25,
      coupon_code: 'GOLD10',
      shipping_fee: 0,
      tax_amount: 20,
      wallet_applied: 10,
      estimated_total: 425,
      total: 425,
      amount_due: 415,
      ship_to: { line1: 'Marina', city: 'Dubai', country: 'UAE' },
      items: [
        {
          id: 'i1',
          product_name: 'Classic Ring',
          sku: 'RING-1',
          variant_label: 'Size 16',
          purity: '22k',
          weight_grams: 4,
          effective_weight: 3.8,
          qty: 1,
          unit_price: 400,
          line_total: 400,
          customization_request: 'Engrave Aisha',
        },
      ],
      status_history: [{ status: 'placed', created_at: '2026-07-20T10:00:00.000Z' }],
    }),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

vi.mock('@/hooks/useReturns', () => ({
  useOrderReturns: () => ({ data: [], isLoading: false }),
  useCreateReturn: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useStoreSettings', () => ({
  useStoreSettings: () => ({ data: { store_name: 'GOLDEX', support_email: 'goldexdxb@gmail.com' } }),
}))

vi.mock('@/lib/orderInvoice', () => ({
  openOrderInvoice: vi.fn(),
}))

describe('OrderDetailPage', () => {
  it('renders items, coupon, wallet, shipping and awaiting verification', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/orders/ord1']}>
        <I18nextProvider i18n={i18n}>
          <Routes>
            <Route path="/orders/:id" element={<OrderDetailPage />} />
          </Routes>
        </I18nextProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Classic Ring')).toBeTruthy()
    expect(screen.getByText(/RING-1/)).toBeTruthy()
    expect(screen.getByText(/Engrave Aisha/)).toBeTruthy()
    expect(screen.getByText(/GOLD10/)).toBeTruthy()
    expect(screen.getByText(/Wallet applied/i)).toBeTruthy()
    expect(screen.getByText(/Free/i)).toBeTruthy()
    expect(screen.getByText(/awaiting store verification/i)).toBeTruthy()
    expect(screen.queryByText(/checkout:paymentMethods/i)).toBeNull()
  })
})
