import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, ShoppingBag, User, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useGoldRate } from '@/hooks/useGoldRate'
import { formatINR } from '@/lib/pricing'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { useCartBadge } from '@/contexts/CartContext'
import { BrandWordmark } from '@/components/ui/BrandLogo'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'

export function Header() {
  const { t } = useTranslation(['nav', 'common'])
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { data: rates } = useGoldRate()
  const { isAuthenticated } = useCustomerAuth()
  const { count: cartCount } = useCartBadge()
  const rate22k = rates?.find((r) => r.purity === '22k')
  const handleSearch = (e) => {
    e.preventDefault()
    if (!query.trim()) return
    navigate(`/search?q=${encodeURIComponent(query.trim())}`)
    setSearchOpen(false)
    setQuery('')
  }

  return (
    <header id="storefront-header" className="sticky top-0 z-40 overflow-x-clip border-b border-gold/20 bg-ivory/95 backdrop-blur-md">
      <div className="mx-auto max-w-[1320px] px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3 md:gap-6">
          <Link to="/" className="flex shrink-0 items-center">
            <BrandWordmark className="h-8 sm:h-10" />
          </Link>

          {rate22k && (
            <div className="hidden rounded-full border border-gold/30 bg-ivory-2 px-3 py-1 text-xs font-semibold text-gold lg:block">
              {t('common:goldRatePerGram', { rate: formatINR(rate22k.rate_per_gram) })}
            </div>
          )}

          <nav className="ms-auto hidden items-center gap-6 text-sm font-medium text-navy lg:flex">
            <Link to="/" className="hover:text-gold">
              {t('nav:home')}
            </Link>
            <Link to="/search" className="hover:text-gold">
              {t('nav:shopAll')}
            </Link>
          </nav>

          <div className="ms-auto flex shrink-0 items-center gap-0.5 sm:gap-1 lg:ms-0">
            <LanguageSwitcher className="shrink-0" compact />

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 min-h-0 shrink-0 lg:hidden lg:h-11 lg:w-11"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label={t('nav:searchAria')}
            >
              <Search className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
            </Button>

            <form onSubmit={handleSearch} className="hidden lg:block lg:flex-1 lg:max-w-sm">
              <div className="relative">
                <Search className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('nav:searchPlaceholder')}
                  className="ps-10"
                />
              </div>
            </form>

            <Button
              variant="ghost"
              size="icon"
              asChild
              aria-label={t('nav:accountAria')}
              className="h-9 w-9 min-h-0 shrink-0 lg:h-11 lg:w-11"
            >
              <Link to={isAuthenticated ? '/account' : '/login'}>
                <User className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
              </Link>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              asChild
              aria-label={t('nav:cartAria')}
              className="relative h-9 w-9 min-h-0 shrink-0 lg:h-11 lg:w-11"
            >
              <Link to="/cart">
                <ShoppingBag className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                {cartCount > 0 && (
                  <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-navy px-0.5 text-[9px] font-bold text-gold-3 sm:h-5 sm:min-w-5 sm:text-[10px]">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Link>
            </Button>
          </div>
        </div>

        {searchOpen && (
          <div className="mt-2 space-y-2 lg:hidden sm:mt-3 sm:space-y-3">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('nav:searchPlaceholder')}
                  className="ps-10"
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted"
                  onClick={() => setSearchOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </header>
  )
}
