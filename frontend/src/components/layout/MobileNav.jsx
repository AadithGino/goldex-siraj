import { Link, useLocation } from 'react-router-dom'
import { Home, Grid3X3, Heart, ShoppingBag, User, PiggyBank } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { useCartBadge } from '@/contexts/CartContext'
import { useStoreSettings } from '@/hooks/useStoreSettings'

export function MobileNav() {
  const { t } = useTranslation('nav')
  const location = useLocation()
  const { isAuthenticated } = useCustomerAuth()
  const { count: cartCount } = useCartBadge()
  const { data: settings } = useStoreSettings()

  const baseNav = [
    { to: '/', label: t('home'), icon: Home },
    { to: '/search', label: t('shop'), icon: Grid3X3 },
    { to: '/wishlist', label: t('wishlist'), icon: Heart, auth: true },
    { to: '/cart', label: t('cart'), icon: ShoppingBag, auth: true },
    { to: '/account', label: t('account'), icon: User, auth: true, fallback: '/login' },
  ]

  const navItems = settings?.scheme_enabled
    ? [
        baseNav[0],
        baseNav[1],
        { to: '/scheme', label: t('scheme'), icon: PiggyBank, auth: true, fallback: '/login' },
        baseNav[3],
        baseNav[4],
      ]
    : baseNav

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 w-full max-w-[100vw] overflow-x-clip border-t border-gold/20 bg-ivory/95 backdrop-blur-md md:hidden">
      <div className="mx-auto flex w-full max-w-[1320px] items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {navItems.map(({ to, label, icon: Icon, auth, fallback }) => {
          const href = auth && !isAuthenticated && fallback ? fallback : to
          const active = location.pathname === href
            || (to === '/account' && location.pathname.startsWith('/orders'))
            || (to === '/scheme' && location.pathname.startsWith('/scheme'))
          return (
            <Link
              key={to}
              to={href}
              className={cn(
                'relative flex min-h-[var(--mobile-nav-height)] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-semibold',
                active ? 'text-gold' : 'text-muted'
              )}
            >
              <Icon className="h-5 w-5" />
              {to === '/cart' && cartCount > 0 && (
                <span className="absolute end-1/4 top-1.5 flex h-4 min-w-4 translate-x-1/2 items-center justify-center rounded-full bg-navy px-1 text-[9px] font-bold text-gold-3">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
