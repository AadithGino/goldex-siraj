import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminReportsPage } from './AdminReportsPage.jsx'

vi.mock('@/hooks/useAdminReports', () => ({
  useSalesReport: () => ({
    data: {
      total_sales: 30.55,
      order_count: 1,
      by_day: [{ date: '2026-07-20', total_sales: 30.55, order_count: 1 }],
    },
    isLoading: false,
  }),
  useTopProducts: () => ({
    data: [{ product_id: 'p1', product_name: 'Classic Ring', qty_sold: 2, revenue: 500 }],
  }),
}))

vi.mock('@/hooks/useAdminInventory', () => ({
  useAdminLowStock: () => ({ data: [{ id: 'v1' }] }),
}))

describe('AdminReportsPage contract fields', () => {
  it('renders total_sales, by_day.total_sales, and qty_sold without legacy aliases', () => {
    render(<AdminReportsPage />)
    expect(screen.getAllByText(/AED\s*30\.55/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Classic Ring/)).toBeTruthy()
    expect(screen.getByText(/2 sold/)).toBeTruthy()
    expect(screen.getByText(/1 orders/)).toBeTruthy()
  })
})
