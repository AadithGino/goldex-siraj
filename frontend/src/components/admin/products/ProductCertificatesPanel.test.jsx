import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import {
  ProductCertificatesPanel,
  ADMIN_CERTIFICATE_PAGE_SIZE,
} from './ProductCertificatesPanel.jsx'

const certsMock = vi.fn()
const createMutate = vi.fn()
const removeMutate = vi.fn()

vi.mock('@/hooks/useAdminCertificates', () => ({
  useAdminCertificates: (...args) => certsMock(...args),
  useAdminCertificateMutations: () => ({
    create: { mutateAsync: createMutate, isPending: false },
    remove: { mutateAsync: removeMutate, isPending: false },
    update: { mutateAsync: vi.fn(), isPending: false },
  }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

function renderPanel(productId = 'prod-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <ProductCertificatesPanel
            productId={productId}
            variants={[{ id: 'v1', variant_label: '16', sku: 'SKU-1' }]}
          />
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

describe('ProductCertificatesPanel pagination', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    certsMock.mockReset()
    createMutate.mockReset()
    removeMutate.mockReset()
  })

  it('clicking Next requests page 2 and renders its certificate', async () => {
    certsMock.mockImplementation((_productId, query = {}) => {
      const page = query.page ?? 1
      if (page === 1) {
        return {
          data: {
            data: [{
              id: 'c1',
              cert_number: 'PAGE1-CERT',
              authority: 'GIA',
              issued_date: '2026-03-15T00:00:00.000+04:00',
              file_url: null,
            }],
            meta: { page: 1, limit: ADMIN_CERTIFICATE_PAGE_SIZE, total: 2, pages: 2 },
          },
          isLoading: false,
          isFetching: false,
        }
      }
      return {
        data: {
          data: [{
            id: 'c2',
            cert_number: 'PAGE2-CERT',
            authority: 'IGI',
            issued_date: null,
            file_url: null,
          }],
          meta: { page: 2, limit: ADMIN_CERTIFICATE_PAGE_SIZE, total: 2, pages: 2 },
        },
        isLoading: false,
        isFetching: false,
      }
    })

    renderPanel()
    expect(screen.getByText('#PAGE1-CERT')).toBeTruthy()
    expect(screen.getByText('Issued 2026-03-15')).toBeTruthy()
    expect(certsMock).toHaveBeenCalledWith('prod-1', {
      page: 1,
      limit: ADMIN_CERTIFICATE_PAGE_SIZE,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => {
      expect(certsMock).toHaveBeenCalledWith('prod-1', {
        page: 2,
        limit: ADMIN_CERTIFICATE_PAGE_SIZE,
      })
      expect(screen.getByText('#PAGE2-CERT')).toBeTruthy()
    })
    expect(screen.queryByText('#PAGE1-CERT')).toBeNull()
  })
})
