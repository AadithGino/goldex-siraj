import { createContext, useContext, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

const StaffAuthContext = createContext(null)

export function StaffAuthProvider({ children }) {
  const queryClient = useQueryClient()
  const profile = useQuery({ queryKey: ['staff-profile'], queryFn: () => api.get('/staff/auth/me'), retry: false })
  const staff = profile.data || null

  const signInWithEmail = async (email, password) => {
    const result = await api.post('/staff/auth/login', { email, password })
    queryClient.setQueryData(['staff-profile'], result.user)
    return result
  }
  const signInWithGoogle = async () => { throw new Error('Google staff login is not enabled. Use email and password.') }
  const signOut = async () => { await api.post('/staff/auth/logout').catch(() => null); queryClient.setQueryData(['staff-profile'], null) }

  const value = useMemo(() => ({ staff, role: staff?.role || null, isLoading: profile.isLoading, isStaff: !!staff, hasSession: !!staff, isError: profile.isError && profile.error?.status !== 401, signInWithEmail, signInWithGoogle, signOut }), [staff, profile.isLoading, profile.isError, profile.error])
  return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>
}

export function useStaffAuth() {
  const context = useContext(StaffAuthContext)
  if (!context) throw new Error('useStaffAuth must be used within StaffAuthProvider')
  return context
}
