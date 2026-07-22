import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { toast } from 'sonner'
import i18n from '@/i18n'
import { AddToBagButton } from './AddToBagButton.jsx'
import { ApiError } from '@/lib/api'

const add = vi.fn()

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('@/contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({ isAuthenticated: true }),
}))

vi.mock('@/hooks/useCart', () => ({
  useCart: () => ({ add, isAdding: false }),
}))

function wrap(ui) {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
    </MemoryRouter>,
  )
}

describe('AddToBagButton', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    add.mockReset()
    add.mockResolvedValue({})
    toast.success.mockReset()
    toast.error.mockReset()
  })

  it('trims customization and sends null when blank', async () => {
    wrap(<AddToBagButton variantId="v1" customizationRequest="  " />)
    fireEvent.click(screen.getByRole('button', { name: /add to bag/i }))
    await waitFor(() => {
      expect(add).toHaveBeenCalledWith({
        variantId: 'v1',
        qty: 1,
        customizationRequest: null,
      })
    })
  })

  it('sends trimmed customization text', async () => {
    wrap(<AddToBagButton variantId="v1" qty={1} customizationRequest="  Hello  " />)
    fireEvent.click(screen.getByRole('button', { name: /add to bag/i }))
    await waitFor(() => {
      expect(add).toHaveBeenCalledWith({
        variantId: 'v1',
        qty: 1,
        customizationRequest: 'Hello',
      })
    })
  })

  it('shows a readable validation error message', async () => {
    add.mockRejectedValue(new ApiError('Request validation failed', 422, 'VALIDATION_ERROR'))
    wrap(<AddToBagButton variantId="v1" customizationRequest="x" />)
    fireEvent.click(screen.getByRole('button', { name: /add to bag/i }))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Request validation failed')
    })
  })
})
