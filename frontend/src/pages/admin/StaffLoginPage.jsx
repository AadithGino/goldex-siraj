import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useStaffAuth } from '@/contexts/StaffAuthContext'
import { BrandWordmark } from '@/components/ui/BrandLogo'

export function StaffLoginPage() {
  const navigate = useNavigate()
  const { signInWithEmail, isStaff, isLoading } = useStaffAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory px-4">
        <div className="w-full max-w-md rounded-[28px] border border-gold/20 bg-ivory-2 p-8">
          <Skeleton className="mx-auto h-8 w-32" />
          <Skeleton className="mt-8 h-10 w-full" />
          <Skeleton className="mt-4 h-10 w-full" />
          <Skeleton className="mt-4 h-10 w-full" />
        </div>
      </div>
    )
  }

  if (isStaff) {
    return <Navigate to="/admin" replace />
  }

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signInWithEmail(email, password)
      toast.success('Signed in successfully')
      navigate('/admin', { replace: true })
    } catch (err) {
      toast.error(err.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory px-4">
      <div className="w-full max-w-md rounded-[28px] border border-gold/20 bg-ivory-2 p-6 shadow-[0_14px_34px_rgba(7,21,37,.09)] sm:p-8">
        <div className="text-center">
          <div className="flex items-center justify-center">
            <BrandWordmark className="h-12" />
          </div>
          <h1 className="mt-2 font-display text-xl text-navy">Staff Sign In</h1>
          <p className="mt-2 text-sm text-muted">Admin access only. No public signup.</p>
        </div>

        <form onSubmit={handleEmailLogin} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-navy">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-navy">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in with Email'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link to="/" className="text-gold hover:underline">
            Back to storefront
          </Link>
        </p>
      </div>
    </div>
  )
}
