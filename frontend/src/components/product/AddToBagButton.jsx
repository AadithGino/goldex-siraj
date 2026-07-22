import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { useCart } from '@/hooks/useCart'

export function AddToBagButton({
  variantId,
  qty = 1,
  customizationRequest,
  className,
  variant = 'default',
  size = 'default',
  children,
  onSuccess,
}) {
  const { t } = useTranslation(['product', 'common', 'errors'])
  const navigate = useNavigate()
  const { isAuthenticated } = useCustomerAuth()
  const { add, isAdding } = useCart()
  const label = children ?? t('product:addToBag')

  const handleClick = async (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()

    if (!variantId) return

    if (!isAuthenticated) {
      toast.info(t('common:signInToAddBag'))
      navigate('/login', { state: { from: window.location.pathname } })
      return
    }

    try {
      await add({ variantId, qty, customizationRequest: customizationRequest?.trim() || null })
      toast.success(t('common:addedToBag'))
      onSuccess?.()
    } catch (err) {
      toast.error(err.message || t('errors:cart.addToBagFailed'))
    }
  }

  return (
    <Button
      className={className}
      variant={variant}
      size={size}
      disabled={!variantId || isAdding}
      onClick={handleClick}
    >
      {isAdding ? t('common:adding') : label}
    </Button>
  )
}
