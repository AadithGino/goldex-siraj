import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import { CouponUsageDialog } from './CouponUsageDialog.jsx'

const usageMock = vi.fn()

vi.mock('@/hooks/useAdminCoupons', () => ({
  useAdminCouponUsage: (...args) => usageMock(...args),
}))

function renderDialog(props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <CouponUsageDialog
            open
            onOpenChange={() => {}}
            coupon={{ id: 'c1', code: 'FLAT10' }}
            {...props}
          />
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

describe('CouponUsageDialog', () => {
  beforeEach(() => {
    usageMock.mockReset()
  })

  it('renders flattened customer/order fields and AED discount', () => {
    usageMock.mockReturnValue({
      data: {
        data: [{
          redemption_id: 'r1',
          customer_id: 'cust1',
          customer_name: 'Coupon Buyer',
          customer_phone: '+971501000222',
          customer_email: 'coupon.buyer@example.com',
          order_id: 'ord1',
          order_number: 'ORD-2026-0000009',
          order_status: 'placed',
          payment_status: 'cod_pending',
          payment_method: 'cod',
          payment_mode: null,
          invoice_number: null,
          discount_amount: 30.55,
          created_at: '2026-07-20T10:00:00.000Z',
          status: 'active',
          rolled_back_at: null,
          rollback_reason: null,
          rolled_back_by: null,
        }],
        meta: { page: 1, limit: 20, total: 1, pages: 1 },
      },
      isLoading: false,
      isFetching: false,
      error: null,
    })

    renderDialog()
    expect(screen.getByText('Coupon Buyer')).toBeTruthy()
    expect(screen.getByText('+971501000222')).toBeTruthy()
    expect(screen.getByText('coupon.buyer@example.com')).toBeTruthy()
    expect(screen.getByText('ORD-2026-0000009')).toBeTruthy()
    expect(screen.getByText(/AED\s*30\.55/)).toBeTruthy()
    expect(screen.getByText('Active')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Coupon Buyer' }).getAttribute('href')).toBe('/admin/customers/cust1')
    expect(screen.getByRole('link', { name: 'ORD-2026-0000009' }).getAttribute('href')).toBe('/admin/orders/ord1')
  })

  it('renders rolled-back badge and staff rollback details', () => {
    usageMock.mockReturnValue({
      data: {
        data: [{
          redemption_id: 'r2',
          customer_name: 'A',
          customer_phone: null,
          customer_email: null,
          order_number: 'ORD-1',
          order_id: 'o1',
          customer_id: 'c1',
          order_status: 'cancelled',
          payment_status: 'refunded',
          payment_method: 'cod',
          discount_amount: 10,
          created_at: '2026-07-19T10:00:00.000Z',
          status: 'rolled_back',
          rolled_back_at: '2026-07-20T11:00:00.000Z',
          rollback_reason: 'Customer requested cancel',
          rolled_back_by: { id: 's1', full_name: 'Coupon Admin', email: 'a@example.com' },
        }],
        meta: { page: 1, limit: 20, total: 1, pages: 1 },
      },
      isLoading: false,
      isFetching: false,
      error: null,
    })

    renderDialog()
    expect(screen.getByText('Rolled back')).toBeTruthy()
    expect(screen.getByText('Customer requested cancel')).toBeTruthy()
    expect(screen.getByText(/By Coupon Admin/)).toBeTruthy()
  })

  it('renders — for missing related records and invalid dates without crashing', () => {
    usageMock.mockReturnValue({
      data: {
        data: [{
          redemption_id: 'r3',
          customer_id: null,
          customer_name: null,
          customer_phone: null,
          customer_email: null,
          order_id: null,
          order_number: null,
          order_status: null,
          payment_status: null,
          payment_method: null,
          payment_mode: null,
          invoice_number: null,
          discount_amount: 5,
          created_at: 'not-a-date',
          status: 'active',
          rolled_back_at: 'also-bad',
          rollback_reason: null,
          rolled_back_by: null,
        }],
        meta: { page: 1, limit: 20, total: 1, pages: 1 },
      },
      isLoading: false,
      isFetching: false,
      error: null,
    })

    renderDialog()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4)
    expect(screen.getByText(/AED\s*5\.00/)).toBeTruthy()
  })

  it('only enables usage query when dialog is open with a coupon id', () => {
    usageMock.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 20, total: 0, pages: 1 } },
      isLoading: false,
      isFetching: false,
      error: null,
    })
    renderDialog({ open: true, coupon: { id: 'c9', code: 'X' } })
    expect(usageMock).toHaveBeenCalledWith('c9', { page: 1, limit: 20 }, true)

    usageMock.mockClear()
    renderDialog({ open: false, coupon: { id: 'c9', code: 'X' } })
    expect(usageMock).toHaveBeenCalledWith('c9', { page: 1, limit: 20 }, false)
  })
})
