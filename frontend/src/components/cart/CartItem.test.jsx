import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import { CartItem } from './CartItem.jsx'

vi.mock('@/hooks/usePriceBreakup', () => ({
  usePriceBreakup: () => ({ data: { total: 100, display_total: 100 }, isLoading: false }),
}))

vi.mock('@/hooks/useContentLang', () => ({
  useContentLang: () => 'en',
}))

describe('CartItem customization display', () => {
  it('renders customization_request safely as text', () => {
    render(
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <CartItem
            item={{
              id: 'c1',
              qty: 1,
              variant_id: 'v1',
              price_snapshot: 100,
              customization_request: 'Engrave <b>Aisha</b>',
              product_variants: {
                products: {
                  name: 'Gold Ring',
                  slug: 'gold-ring',
                  purity: '22k',
                  product_variants: [],
                },
              },
            }}
            onUpdateQty={vi.fn()}
            onUpdateVariant={vi.fn()}
            onRemove={vi.fn()}
            isUpdating={false}
          />
        </I18nextProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText(/Engrave <b>Aisha<\/b>/)).toBeTruthy()
    expect(document.querySelector('b')).toBeNull()
  })
})
