import { Navigate, useLocation } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useStaffAuth } from '@/contexts/StaffAuthContext'

export function RequireStaff({ children }) {
  const { isStaff, isLoading, isError, hasSession, signOut } = useStaffAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-ivory">
        <div className="hidden w-60 shrink-0 border-r border-gold/20 bg-ivory-2 md:block">
          <div className="p-4">
            <Skeleton className="h-7 w-28" />
            <div className="mt-6 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col">
          <Skeleton className="h-16 w-full rounded-none" />
          <div className="flex-1 p-4 sm:p-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="mt-6 h-64 w-full rounded-[28px]" />
          </div>
        </div>
      </div>
    )
  }

  // SE4: surface RLS/network errors instead of silently redirecting
  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory px-4">
        <div className="max-w-sm rounded-[28px] border border-gold/20 bg-ivory-2 p-8 text-center">
          <p className="font-display text-lg text-navy">Could not load admin</p>
          <p className="mt-2 text-sm text-muted">
            A server error occurred while verifying your access. Check your connection and try again.
          </p>
          <Button className="mt-6 w-full" onClick={() => window.location.reload()}>
            Retry
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    )
  }

  // SE6: user is signed in via Google/email but has no staff row → prevent redirect loop
  if (!isStaff && hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory px-4">
        <div className="max-w-sm rounded-[28px] border border-gold/20 bg-ivory-2 p-8 text-center">
          <p className="font-display text-lg text-navy">Access not authorised</p>
          <p className="mt-2 text-sm text-muted">
            Your account is not registered as a Goldex staff member. Contact the store owner to be
            added.
          </p>
          <Button className="mt-6 w-full" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    )
  }

  if (!isStaff) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return children
}
