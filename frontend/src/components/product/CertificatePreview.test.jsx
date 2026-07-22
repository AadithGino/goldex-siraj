import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import { CertificatePreview } from './CertificatePreview.jsx'
import { CUSTOMER_CERTIFICATE_PAGE_SIZE } from '@/hooks/useCertificates'

const certsMock = vi.fn()

vi.mock('@/hooks/useCertificates', async () => {
  const actual = await vi.importActual('@/hooks/useCertificates')
  return {
    ...actual,
    useCertificates: (...args) => certsMock(...args),
  }
})

function wrap(ui) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          {ui}
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

describe('CertificatePreview customer pagination', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    certsMock.mockReset()
  })

  it('clicking Next requests page 2 and renders its certificate', async () => {
    certsMock.mockImplementation((_productId, _variantId, opts = {}) => {
      const page = opts.page ?? 1
      if (page === 1) {
        return {
          data: {
            data: [{
              id: 'c1',
              cert_number: 'CUST-P1',
              authority: 'GIA',
              issued_date: '2026-03-14T20:00:00.000Z',
              metadata: {},
              file_url: null,
            }],
            meta: { page: 1, limit: CUSTOMER_CERTIFICATE_PAGE_SIZE, total: 2, pages: 2 },
          },
          isLoading: false,
          isFetching: false,
        }
      }
      return {
        data: {
          data: [{
            id: 'c2',
            cert_number: 'CUST-P2',
            authority: 'IGI',
            issued_date: null,
            metadata: {},
            file_url: null,
          }],
          meta: { page: 2, limit: CUSTOMER_CERTIFICATE_PAGE_SIZE, total: 2, pages: 2 },
        },
        isLoading: false,
        isFetching: false,
      }
    })

    wrap(<CertificatePreview productId="prod-1" variantId="v1" />)

    await waitFor(() => {
      expect(screen.getByText(/CUST-P1/)).toBeTruthy()
    })
    expect(screen.getByTestId('cert-list-incomplete').textContent).toMatch(/incomplete/i)
    expect(certsMock).toHaveBeenCalledWith('prod-1', 'v1', {
      page: 1,
      limit: CUSTOMER_CERTIFICATE_PAGE_SIZE,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => {
      expect(certsMock).toHaveBeenCalledWith('prod-1', 'v1', {
        page: 2,
        limit: CUSTOMER_CERTIFICATE_PAGE_SIZE,
      })
      expect(screen.getByText(/CUST-P2/)).toBeTruthy()
    })
    expect(screen.queryByText(/CUST-P1/)).toBeNull()
  })
})
