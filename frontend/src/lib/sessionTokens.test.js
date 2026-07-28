import { describe, expect, it, beforeEach, vi } from 'vitest'
import { clearTokens, loadTokens, resolvePortal, saveTokens } from './sessionTokens'

describe('sessionTokens', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('resolves portal from admin path and api path', () => {
    expect(resolvePortal('/account', '/customer/auth/me')).toBe('customer')
    expect(resolvePortal('/', '/staff/auth/me')).toBe('staff')
    expect(resolvePortal('/admin/products', '/admin/catalog/products')).toBe('staff')
  })

  it('persists and clears customer tokens', () => {
    saveTokens('customer', { accessToken: 'a1', refreshToken: 'r1' })
    expect(loadTokens('customer')).toEqual({ accessToken: 'a1', refreshToken: 'r1' })
    clearTokens('customer')
    expect(loadTokens('customer')).toEqual({ accessToken: null, refreshToken: null })
  })

  it('keeps staff and customer tokens separate', () => {
    saveTokens('customer', { accessToken: 'c', refreshToken: 'cr' })
    saveTokens('staff', { accessToken: 's', refreshToken: 'sr' })
    expect(loadTokens('customer').accessToken).toBe('c')
    expect(loadTokens('staff').accessToken).toBe('s')
  })
})
