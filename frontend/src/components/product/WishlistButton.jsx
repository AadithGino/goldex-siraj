import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { useWishlist } from '@/hooks/useWishlist'

export function WishlistButton({ productId, className, iconClassName, showLabel = false }) {
  const { t } = useTranslation(['product', 'common', 'errors'])
  const navigate = useNavigate()
  const { isAuthenticated } = useCustomerAuth()
  const { isWishlisted, toggle, isPending } = useWishlist()
  const active = isWishlisted(productId)

  const handleClick = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isAuthenticated) {
      toast.info(t('common:signInToWishlist'))
      navigate('/login', { state: { from: window.location.pathname } })
      return
    }

    try {
      await toggle({ productId, isWishlisted: active })
      toast.success(active ? t('common:removedFromWishlist') : t('common:addedToWishlist'))
    } catch (err) {
      toast.error(err.message || t('errors:wishlist.updateFailed'))
    }
  }

  if (showLabel) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={handleClick}
        className={cn('gap-2', className)}
      >
        <Heart className={cn('h-4 w-4', active && 'fill-current text-gold')} />
        {active ? t('product:inWishlist') : t('product:addToWishlist')}
      </Button>
    )
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleClick}
      className={cn(
        'flex h-9 w-9 items-center justify-center transition-colors hover:text-gold',
        active ? 'text-gold' : 'text-muted',
        className
      )}
      aria-label={active ? t('product:removeWishlistAria') : t('product:addWishlistAria')}
    >
      <Heart className={cn('h-4 w-4', active && 'fill-current', iconClassName)} />
    </button>
  )
}
