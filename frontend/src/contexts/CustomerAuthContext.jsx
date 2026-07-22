import { useAuth, AuthProvider } from '@/contexts/AuthContext'

export function CustomerAuthProvider({ children }) {
  return <AuthProvider>{children}</AuthProvider>
}

export function useCustomerAuth() {
  return useAuth()
}
