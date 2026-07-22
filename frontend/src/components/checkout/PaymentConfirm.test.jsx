import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import { PaymentConfirm } from '@/components/checkout/PaymentConfirm'

vi.mock('@/hooks/useWallet', () => ({
  useWalletBalance: () => ({ data: 0 }),
}))
vi.mock('@/hooks/useStoreSettings', () => ({
  useStoreSettings: () => ({
    data: { cod_enabled: true, bank_transfer_enabled: true },
  }),
}))
vi.mock('@/hooks/useCmsPages', () => ({
  usePublishedCmsPages: () => ({ data: [] }),
}))

function wrap(ui) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PaymentConfirm wording', () => {
  it('describes COD as estimate and manual as locked', async () => {
    const { container } = wrap(
      <PaymentConfirm
        total={1200}
        onConfirm={() => {}}
        isPlacing={false}
        isGift={false}
        giftNote=""
        onIsGiftChange={() => {}}
        onGiftNoteChange={() => {}}
      />,
    )
    expect(container.textContent).toMatch(/estimate/i)
    expect(container.textContent).toMatch(/physically handed/i)

    fireEvent.click(screen.getByRole('button', { name: /Bank transfer/i }))
    await waitFor(() => {
      expect(container.textContent).toMatch(/locked when you place the order/i)
    })
    expect(container.textContent).toMatch(/It is not live-repriced when payment is verified/i)
    expect(container.textContent).not.toMatch(/This is an estimate\. The store confirms/i)
  })
})
