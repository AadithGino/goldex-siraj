import { Navigate, useLocation } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'

export function RequireCustomer({ children }) {
  const { isAuthenticated, isLoading } = useCustomerAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
