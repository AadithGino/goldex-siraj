import { useEffect } from 'react'
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom'
import { Button } from '@/components/ui/button'

function errorMessage(error) {
  if (isRouteErrorResponse(error)) {
    return error.statusText || error.data?.message || `Request failed (${error.status})`
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred'
}

export function RouteErrorBoundary() {
  const error = useRouteError()
  const navigate = useNavigate()
  const isDev = import.meta.env.DEV
  const message = errorMessage(error)

  useEffect(() => {
    console.error('Route error boundary', error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-xs font-black uppercase tracking-[.12em] text-gold">Error</p>
      <h1 className="mt-2 font-display text-3xl text-navy">Something went wrong</h1>
      <p className="mt-3 text-sm text-muted">
        The page hit an unexpected problem. You can retry or go back.
      </p>
      {isDev ? (
        <pre className="mt-4 max-h-48 w-full overflow-auto rounded-2xl border border-gold/20 bg-ivory-2 p-3 text-left text-xs text-navy">
          {message}
          {error instanceof Error && error.stack ? `\n\n${error.stack}` : ''}
        </pre>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={() => window.location.reload()}>
          Retry
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    </div>
  )
}
