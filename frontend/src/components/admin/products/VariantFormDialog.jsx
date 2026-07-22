import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAdminProductMutations } from '@/hooks/useAdminProducts'
import { toFormState } from '@/lib/formUtils'
import { DEFAULT_VARIANT } from '@/lib/productDefaults'
import { VariantStonesEditor, stonesFromVariant } from '@/components/admin/products/VariantStonesEditor'
import { TaxTreatmentField } from '@/components/admin/products/TaxTreatmentField'

function variantToForm(variant) {
  const base = toFormState(DEFAULT_VARIANT, variant)
  if (!variant?.id) {
    return { ...base, product_stones: [] }
  }
  return {
    ...base,
    height_mm: variant.height_mm ?? '',
    width_mm: variant.width_mm ?? '',
    size: variant.size_label ?? '',
    size_label: variant.size_label ?? '',
    ring_size: variant.ring_size ?? '',
    bangle_size: variant.bangle_size ?? '',
    chain_length_inch: variant.chain_length_inch ?? '',
    price_override: variant.fixed_price ?? '',
    weight_grams: variant.weight_grams ?? '',
    effective_weight: variant.effective_weight ?? '',
    purity: variant.purity ?? '22k',
    jewellery_type: variant.jewellery_type ?? '',
    tax_treatment: variant.tax_treatment ?? '',
    product_stones: stonesFromVariant(variant),
  }
}

export function VariantFormDialog({ open, onOpenChange, productId, variant }) {
  const { createVariant, updateVariant } = useAdminProductMutations()
  const [form, setForm] = useState(variantToForm(variant))
  const isEdit = !!variant?.id

  useEffect(() => {
    if (open) setForm(variantToForm(variant))
  }, [open, variant])

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmedSku = String(form.sku || '').trim()
    const purity = String(form.purity || '').trim().toLowerCase()
    const metalWeight = Number(form.weight_grams)
    const hasEffectiveWeight = form.effective_weight !== '' && form.effective_weight != null
    const effectiveWeight = hasEffectiveWeight ? Number(form.effective_weight) : null
    const fixedPriceRaw = form.price_override ?? form.fixed_price
    const fixedPrice =
      fixedPriceRaw === '' || fixedPriceRaw == null ? null : Number(fixedPriceRaw)
    const trimmedLabel = String(form.variant_label || form.label || '').trim()
    const autoWeight = hasEffectiveWeight ? effectiveWeight : metalWeight
    const resolvedLabel = trimmedLabel || `${purity.toUpperCase()} / ${autoWeight}g`

    if (!trimmedSku) {
      toast.error('SKU is required')
      return
    }
    if (!Number.isFinite(metalWeight) || metalWeight <= 0) {
      toast.error('Metal weight must be greater than 0')
      return
    }
    if (hasEffectiveWeight && (!Number.isFinite(effectiveWeight) || effectiveWeight <= 0)) {
      toast.error('Billing/effective weight must be greater than 0')
      return
    }
    const active = form.is_active !== false
    if (active && (fixedPrice == null || !Number.isFinite(fixedPrice) || fixedPrice <= 0)) {
      if (!purity) {
        toast.error('Purity is required for active live-priced variants')
        return
      }
    }

    try {
      const payload = {
        ...form,
        sku: trimmedSku,
        purity,
        label: resolvedLabel,
        variant_label: resolvedLabel,
      }
      if (isEdit) {
        await updateVariant.mutateAsync({
          id: variant.id,
          product_id: productId,
          ...payload,
          expected_stock_qty: variant.stock_qty ?? 0,
        })
        toast.success('Variant updated')
      } else {
        await createVariant.mutateAsync({
          ...payload,
          product_id: productId,
        })
        toast.success('Variant created')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err.message || 'Save failed')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit variant' : 'New variant'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update variant pricing and attributes.' : 'Add a product variant.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">SKU / Product code</label>
            <Input value={form.sku} onChange={(e) => update('sku', e.target.value)} required />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Label</label>
            <Input
              value={form.variant_label || ''}
              onChange={(e) => update('variant_label', e.target.value)}
              placeholder="Size 14, 20 inch, Pair"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Purity *</label>
              <select
                value={form.purity || '22k'}
                onChange={(e) => update('purity', e.target.value)}
                className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm"
              >
                {['14k', '18k', '21k', '22k', '24k'].map((purityOption) => (
                  <option key={purityOption} value={purityOption}>
                    {purityOption.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Metal / gross weight (g)</label>
              <Input
                type="number"
                step="0.001"
                value={form.weight_grams}
                onChange={(e) => update('weight_grams', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Billing / effective weight (g)</label>
              <Input
                type="number"
                step="0.001"
                value={form.effective_weight ?? ''}
                onChange={(e) => update('effective_weight', e.target.value)}
              />
              <p className="mt-1 text-xs text-muted">
                Used for live gold pricing. If empty, metal weight is used.
              </p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Size</label>
              <Input value={form.size || ''} onChange={(e) => update('size', e.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Height (mm)</label>
              <Input
                type="number"
                step="0.01"
                value={form.height_mm ?? ''}
                onChange={(e) => update('height_mm', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Width (mm)</label>
              <Input
                type="number"
                step="0.01"
                value={form.width_mm ?? ''}
                onChange={(e) => update('width_mm', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Stock qty</label>
              <Input
                type="number"
                value={form.stock_qty}
                onChange={(e) => update('stock_qty', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Low stock at</label>
              <Input
                type="number"
                value={form.low_stock_threshold}
                onChange={(e) => update('low_stock_threshold', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">Jewellery type</label>
              <select
                value={form.jewellery_type || form.size_type || 'ring'}
                onChange={(e) => update('jewellery_type', e.target.value)}
                className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm"
              >
                {['ring', 'earring', 'necklace', 'bangle', 'bracelet', 'pendant', 'chain', 'bar', 'coin', 'anklet', 'other'].map(
                  (type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <TaxTreatmentField
            value={form.tax_treatment || ''}
            onChange={(v) => update('tax_treatment', v)}
            purity={form.purity}
            jewelleryType={form.jewellery_type || form.size_type}
            allowInherit
          />

          <VariantStonesEditor
            stones={form.product_stones || []}
            onChange={(product_stones) => update('product_stones', product_stones)}
          />

          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Price override (optional)</label>
            <Input
              type="number"
              value={form.price_override || ''}
              onChange={(e) => update('price_override', e.target.value)}
              placeholder="Fixed AED price — bypasses gold calc"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => update('is_active', e.target.checked)}
            />
            Active
          </label>
          <Button type="submit" className="w-full">
            {isEdit ? 'Save variant' : 'Create variant'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
