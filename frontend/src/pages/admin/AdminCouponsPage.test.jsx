import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminCouponsPage } from './AdminCouponsPage.jsx'

vi.mock('@/hooks/useStaffRole', () => ({
  useStaffRole: () => ({ canManageCatalog: true }),
}))

vi.mock('@/hooks/useAdminCoupons', () => ({
  useAdminCoupons: () => ({
    data: {
      data: [{
        id: 'c1',
        code: 'FLAT10',
        discount_type: 'flat',
        discount_value: 30.55,
        min_order: 0,
        usage_limit: 100,
        used_count: 99,
        is_active: true,
        valid_to: null,
      }],
      meta: { page: 1, limit: 25, total: 1, pages: 1 },
    },
  }),
  useAdminCouponUsageSummary: () => ({
    data: [{
      coupon_id: 'c1',
      code: 'FLAT10',
      active_usage_count: 1,
      rolled_back_count: 0,
      unique_customer_count: 1,
      total_active_discount: 30.55,
      lifetime_usage_count: 1,
    }],
  }),
  useAdminCouponMutations: () => ({ remove: { mutateAsync: vi.fn() } }),
}))

vi.mock('@/components/admin/coupons/CouponFormDialog', () => ({
  CouponFormDialog: () => null,
}))

vi.mock('@/components/admin/coupons/CouponUsageDialog', () => ({
  CouponUsageDialog: () => null,
}))

describe('AdminCouponsPage summary', () => {
  it('shows active discount and usage from summary fields, not Coupon.used_count', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminCouponsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByText(/Used:\s*1\/100/)).toBeTruthy()
    expect(screen.getByText(/Active discount:\s*AED\s*30\.55/)).toBeTruthy()
    expect(screen.getByText(/Rolled back:\s*0/)).toBeTruthy()
    expect(screen.getByText(/Unique customers:\s*1/)).toBeTruthy()
    expect(screen.queryByText(/Used:\s*99/)).toBeNull()
  })
})
