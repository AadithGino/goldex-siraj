import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import { OrderList } from './OrderList.jsx'
import { adaptOrder } from '@/lib/orderAdapter'

function renderList(orders) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <I18nextProvider i18n={i18n}>
        <OrderList orders={orders} isLoading={false} />
      </I18nextProvider>
    </MemoryRouter>,
  )
}

describe('OrderList', () => {
  it('renders a nonzero item count from backend items', () => {
    const order = adaptOrder({
      id: 'ord1',
      order_number: 'ORD-2026-0000001',
      status: 'placed',
      placed_at: '2026-07-20T10:00:00.000Z',
      payment_method: 'cod',
      payment_status: 'cod_pending',
      pricing_mode: 'cod_delivery',
      estimated_total: 500,
      total: 500,
      items: [
        { id: 'i1', product_name: 'Classic Ring', qty: 1, image_url: 'https://cdn.example.com/a.jpg' },
        { id: 'i2', product_name: 'Bangle', qty: 1 },
      ],
    })

    renderList([order])
    expect(screen.getByText('ORD-2026-0000001')).toBeTruthy()
    expect(screen.getByText(/Classic Ring/)).toBeTruthy()
    expect(screen.getByText(/\+ 1/)).toBeTruthy()
    expect(screen.queryByText(/0 items/i)).toBeNull()
  })

  it('shows coupon and does not crash without images', () => {
    const order = adaptOrder({
      id: 'ord2',
      order_number: 'ORD-2026-0000002',
      status: 'placed',
      placed_at: '2026-07-20T10:00:00.000Z',
      payment_method: 'manual',
      payment_status: 'pending',
      coupon_code: 'GOLD10',
      discount_amount: 25,
      total: 475,
      items: [{ id: 'i1', product_name: 'Necklace', qty: 1 }],
    })
    renderList([order])
    expect(screen.getByText(/GOLD10/)).toBeTruthy()
    expect(screen.getByAltText('Necklace')).toBeTruthy()
  })
})
