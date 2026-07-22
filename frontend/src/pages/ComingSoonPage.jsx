import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function ComingSoonPage({ title, description }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
      <p className="text-xs font-black uppercase tracking-[.12em] text-gold">Coming soon</p>
      <h1 className="mt-2 font-display text-3xl text-navy">{title}</h1>
      <p className="mt-3 text-sm text-muted">
        {description || 'This feature will be available in the next release.'}
      </p>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/">Continue shopping</Link>
      </Button>
    </div>
  )
}
