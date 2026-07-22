import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardPage } from './DashboardPage.jsx'

vi.mock('@/hooks/useAdminDashboard', () => ({
  useAdminDashboard: () => ({
    data: {
      timezone: 'Asia/Dubai',
      today_sales: 120.5,
      orders_today: 2,
      month_sales: 900,
      month_orders: 7,
      orders_by_status: { placed: 3, delivered: 1 },
      pending_orders: 4,
      pending_reviews: 5,
      pending_returns: 1,
      low_stock_count: 6,
      active_customer_count: 11,
    },
    isLoading: false,
    isError: false,
  }),
}))

describe('DashboardPage contract fields', () => {
  it('reads today_sales/orders_today and attention metrics from the dashboard contract', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/AED\s*120\.50/)).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('Pending orders')).toBeTruthy()
    expect(screen.getByText('Active customers')).toBeTruthy()
    expect(screen.getByText('11')).toBeTruthy()
    expect(screen.getByText('placed')).toBeTruthy()
  })
})
