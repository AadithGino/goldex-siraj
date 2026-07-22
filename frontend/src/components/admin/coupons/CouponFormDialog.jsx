import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAdminCouponMutations } from '@/hooks/useAdminCoupons'
import { couponToFormState, toCouponPayload } from '@/lib/couponPayload'

export function CouponFormDialog({ open, onOpenChange, coupon }) {
  const { create, update } = useAdminCouponMutations()
  const [form, setForm] = useState(couponToFormState(coupon))
  const isEdit = !!coupon?.id
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    if (open) setForm(couponToFormState(coupon))
  }, [open, coupon])

  const handleSubmit = async (e) => {
    e.preventDefault()

    let payload
    try {
      payload = toCouponPayload(form)
    } catch (err) {
      toast.error(err.message || 'Invalid coupon values')
      return
    }

    try {
      if (isEdit) await update.mutateAsync({ id: coupon.id, ...payload })
      else await create.mutateAsync(payload)
      toast.success(isEdit ? 'Updated' : 'Created')
      onOpenChange(false)
    } catch (err) { toast.error(err.message) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit coupon' : 'New coupon'}</DialogTitle><DialogDescription>{isEdit ? 'Update coupon rules and limits.' : 'Create a discount coupon with usage limits.'}</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="CODE" required />
          <Select value={form.discount_type} onValueChange={(v) => set('discount_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Percent</SelectItem>
              <SelectItem value="flat">Flat AED</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" value={form.discount_value} onChange={(e) => set('discount_value', e.target.value)} placeholder="Discount value" required />
          <Input type="number" value={form.min_order} onChange={(e) => set('min_order', e.target.value)} placeholder="Min order AED" />
          <Input type="number" min="1" value={form.max_discount || ''} onChange={(e) => set('max_discount', e.target.value)} placeholder="Max discount cap (percent only)" />
          <Input type="number" value={form.usage_limit || ''} onChange={(e) => set('usage_limit', e.target.value)} placeholder="Total usage limit (blank = unlimited)" />
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Per customer limit</label>
            <Input type="number" min="1" value={form.per_customer_limit || 1} onChange={(e) => set('per_customer_limit', e.target.value)} placeholder="Uses per customer" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">Valid from</label>
              <Input type="datetime-local" value={form.valid_from || ''} onChange={(e) => set('valid_from', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">Valid until</label>
              <Input type="datetime-local" value={form.valid_to || ''} onChange={(e) => set('valid_to', e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Active</label>
          <Button type="submit" className="w-full">{isEdit ? 'Save' : 'Create'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
