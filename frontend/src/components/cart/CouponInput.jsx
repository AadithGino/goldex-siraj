import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useValidateCoupon } from '@/hooks/useCoupons'
import { formatINR } from '@/lib/pricing'

export function CouponInput({ orderTotal, appliedCoupon, onApply, onRemove }) {
  const { t } = useTranslation(['checkout', 'common', 'errors'])
  const [code, setCode] = useState('')
  const { mutateAsync: validate, isPending } = useValidateCoupon()

  const handleApply = async (e) => {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return

    try {
      const result = await validate({ code: trimmed, orderTotal })
      if (!result?.valid) {
        toast.error(result?.message || t('errors:checkout.invalidCoupon'))
        return
      }
      onApply({ code: trimmed, discount: Number(result.discount_amount) })
      toast.success(result.message || t('common:couponApplied'))
      setCode('')
    } catch (err) {
      toast.error(err.message || t('errors:checkout.validateCouponFailed'))
    }
  }

  if (appliedCoupon) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-gold/20 bg-ivory-3 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Tag className="h-4 w-4 text-gold" />
          <span className="font-semibold text-navy">{appliedCoupon.code}</span>
          <span className="text-muted">−{formatINR(appliedCoupon.discount)}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          {t('common:remove')}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleApply} className="flex gap-2">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder={t('checkout:couponPlaceholder')}
        className="flex-1"
      />
      <Button type="submit" variant="outline" disabled={isPending || !code.trim()}>
        {isPending ? t('common:ellipsisButton') : t('common:apply')}
      </Button>
    </form>
  )
}
