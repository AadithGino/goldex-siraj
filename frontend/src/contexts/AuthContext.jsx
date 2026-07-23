import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, clearAccessToken, setAccessToken } from '@/lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [otpPhone, setOtpPhone] = useState(null)

  const refreshCustomer = useCallback(async () => {
    try {
      const profile = await api.get('/customer/auth/me')
      setCustomer(profile)
      queryClient.setQueryData(['customer-profile'], profile)
      return profile
    } catch (error) {
      if (error.status !== 401) throw error
      setCustomer(null)
      return null
    }
  }, [queryClient])

  useEffect(() => {
    let mounted = true
    refreshCustomer().catch((error) => console.error('Auth init failed', error)).finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [refreshCustomer])

  const sendOtp = useCallback(async (phone) => {
    const result = await api.post('/customer/auth/otp/send', { phone })
    setOtpPhone(phone)
    return result
  }, [])

  const verifyOtp = useCallback(async (phone, code) => {
    const result = await api.post('/customer/auth/otp/verify', { phone, code: String(code) })
    if (result?.access_token) setAccessToken(result.access_token)
    setCustomer(result.user)
    queryClient.setQueryData(['customer-profile'], result.user)
    setOtpPhone(null)
    return result
  }, [queryClient])

  const logout = useCallback(async () => {
    await api.post('/customer/auth/logout').catch(() => null)
    clearAccessToken()
    setOtpPhone(null)
    setCustomer(null)
    queryClient.clear()
  }, [queryClient])

  const user = customer ? { id: customer.id, phone: customer.phone, email: customer.email } : null
  const session = customer ? { user } : null
  const value = useMemo(() => ({ session, user, customer, loading, otpPhone, sendOtp, verifyOtp, logout, refreshCustomer, isLoading: loading, isAuthenticated: !!customer, requestOtp: sendOtp, signOut: logout }), [session, user, customer, loading, otpPhone, sendOtp, verifyOtp, logout, refreshCustomer])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
