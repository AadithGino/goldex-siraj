import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatINR } from '@/lib/pricing'
import { usePriceBreakup } from '@/hooks/usePriceBreakup'
import { useAdminProductMutations } from '@/hooks/useAdminProducts'
import { DEFAULT_VARIANT } from '@/lib/productDefaults'
import {
  SIZE_TYPES,
  getSizeOptions,
  getSizeTypeMeta,
  getStoneTypeLabel,
  formatVariantSize,
} from '@/lib/constants'
import { VariantStonesEditor, stonesFromVariant } from '@/components/admin/products/VariantStonesEditor'

function VariantPrice({ variantId }) {
  const { data } = usePriceBreakup(variantId)
  return <span className="text-sm font-semibold text-gold">{data ? formatINR(data.total) : '—'}</span>
}

function variantFormState(initial) {
  const sizeType = initial?.size_type || DEFAULT_VARIANT.size_type
  const sizeChoices = getSizeOptions(sizeType)
  return {
    ...DEFAULT_VARIANT,
    ...(initial || {}),
    purity: initial?.purity || DEFAULT_VARIANT.purity,
    height_mm: initial?.height_mm ?? '',
    width_mm: initial?.width_mm ?? '',
    size_type: sizeType,
    size: initial?.size_label || initial?.size || sizeChoices[0] || '',
    size_label: initial?.size_label || initial?.size || sizeChoices[0] || '',
    ring_size:
      initial?.ring_size || (sizeType === 'ring' ? (initial?.size_label || initial?.size || '') : ''),
    bangle_size:
      initial?.bangle_size ||
      (sizeType === 'bangle' ? (initial?.size_label || initial?.size || '') : ''),
    chain_length_inch: initial?.chain_length_inch ?? '',
    product_stones: stonesFromVariant(initial),
  }
}

function VariantForm({ initial, productId, onDone, onCancel }) {
  const { createVariant, updateVariant } = useAdminProductMutations()
  const [form, setForm] = useState(() => variantFormState(initial))
  const [submitting, setSubmitting] = useState(false)
  const isEdit = !!initial?.id
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  useEffect(() => {
    setForm(variantFormState(initial))
  }, [initial])

  const sizeMeta = getSizeTypeMeta(form.size_type)
  const sizeChoices = getSizeOptions(form.size_type)

  const handleSizeTypeChange = (sizeType) => {
    const options = getSizeOptions(sizeType)
    const nextSize = options[0] || ''
    setForm((prev) => ({
      ...prev,
      size_type: sizeType,
      size: nextSize,
      size_label: nextSize,
      ring_size: sizeType === 'ring' ? nextSize : '',
      bangle_size: sizeType === 'bangle' ? nextSize : '',
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!productId) {
      toast.error('Save product info first')
      return
    }
    const trimmedSku = String(form.sku || '').trim()
    const trimmedLabel = String(form.variant_label || form.label || '').trim()
    const purity = String(form.purity || '').trim().toLowerCase()
    const metalWeight = Number(form.weight_grams)
    const effectiveWeightRaw = form.effective_weight
    const hasEffectiveWeight = effectiveWeightRaw !== '' && effectiveWeightRaw != null
    const effectiveWeight = hasEffectiveWeight ? Number(effectiveWeightRaw) : null
    const fixedPriceRaw = form.price_override ?? form.fixed_price
    const fixedPrice =
      fixedPriceRaw === '' || fixedPriceRaw == null ? null : Number(fixedPriceRaw)

    if (!trimmedSku) {
      toast.error('SKU is required')
      return
    }
    if (!form.size) {
      toast.error('Please select a size')
      return
    }
    if (!Number.isFinite(metalWeight) || metalWeight <= 0) {
      toast.error('Metal weight is required')
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
      if (!Number.isFinite(metalWeight) || metalWeight <= 0) {
        toast.error('Metal weight must be greater than 0 for active live-priced variants')
        return
      }
      if (hasEffectiveWeight && (!Number.isFinite(effectiveWeight) || effectiveWeight <= 0)) {
        toast.error('Effective weight must be greater than 0 when entered')
        return
      }
    }

    const autoWeight = hasEffectiveWeight ? effectiveWeight : metalWeight
    const autoLabel = `${purity.toUpperCase()} / ${autoWeight}g`
    const resolvedLabel = trimmedLabel || autoLabel

    setSubmitting(true)
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
          id: initial.id,
          product_id: productId,
          ...payload,
          expected_stock_qty: initial.stock_qty ?? 0,
        })
        toast.success('Variant updated')
      } else {
        await createVariant.mutateAsync({
          ...payload,
          product_id: productId,
        })
        toast.success('Variant added')
      }
      await onDone()
    } catch (err) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gold/30 bg-ivory p-5">
      <p className="text-sm font-semibold text-navy">{isEdit ? 'Edit variant' : 'New variant'}</p>

      <div className="space-y-4">
        <p className="text-xs font-black uppercase tracking-[.12em] text-gold">Basic SKU</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">SKU *</label>
            <Input value={form.sku} onChange={(e) => update('sku', e.target.value)} required />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Display label</label>
            <Input
              value={form.variant_label || ''}
              onChange={(e) => update('variant_label', e.target.value)}
              placeholder="Auto-generated if left blank (e.g. 22K / 5g)"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Purity *</label>
            <Select value={form.purity || '22k'} onValueChange={(v) => update('purity', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select purity" />
              </SelectTrigger>
              <SelectContent>
                {['14k', '18k', '21k', '22k', '24k'].map((purityOption) => (
                  <SelectItem key={purityOption} value={purityOption}>
                    {purityOption.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Metal weight (g) *</label>
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
              placeholder="Used for live gold pricing"
            />
            <p className="mt-1 text-xs text-muted">
              Used for live gold pricing. If empty, metal weight is used.
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Height (mm)</label>
            <Input
              type="number"
              step="0.01"
              value={form.height_mm ?? ''}
              onChange={(e) => update('height_mm', e.target.value)}
              placeholder="62.75"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Width (mm)</label>
            <Input
              type="number"
              step="0.01"
              value={form.width_mm ?? ''}
              onChange={(e) => update('width_mm', e.target.value)}
              placeholder="11.42"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Stock qty</label>
            <Input type="number" value={form.stock_qty} onChange={(e) => update('stock_qty', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t border-gold/15 pt-4">
        <p className="text-xs font-black uppercase tracking-[.12em] text-gold">Size</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Jewellery type *</label>
            <Select value={form.size_type || 'other'} onValueChange={handleSizeTypeChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SIZE_TYPES.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">{sizeMeta.label} size *</label>
            <Select
              value={form.size || ''}
              onValueChange={(v) => {
                update('size', v)
                update('size_label', v)
                if (form.size_type === 'ring') update('ring_size', v)
                if (form.size_type === 'bangle') update('bangle_size', v)
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
              <SelectContent>
                {sizeChoices.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <VariantStonesEditor
        stones={form.product_stones || []}
        onChange={(product_stones) => update('product_stones', product_stones)}
      />

      <div className="space-y-4 border-t border-gold/15 pt-4">
        <p className="text-xs font-black uppercase tracking-[.12em] text-gold">Pricing & inventory</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Low stock alert at</label>
            <Input
              type="number"
              value={form.low_stock_threshold}
              onChange={(e) => update('low_stock_threshold', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-navy">Price override (optional)</label>
            <Input
              type="number"
              value={form.price_override || ''}
              onChange={(e) => update('price_override', e.target.value)}
              placeholder="Fixed AED — bypasses gold calc"
            />
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => update('is_active', e.target.checked)}
        />
        Active (visible on storefront)
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : isEdit ? 'Save variant' : 'Add variant'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

function variantSummary(variant) {
  const pricingWeight = variant.effective_weight ?? variant.weight_grams
  const parts = [formatVariantSize(variant), `${variant.weight_grams}g metal`]
  if (pricingWeight != null) parts.push(`${pricingWeight}g billing`)
  if (variant.height_mm) parts.push(`${variant.height_mm}mm H`)
  if (variant.width_mm) parts.push(`${variant.width_mm}mm W`)
  const stoneCount = variant.product_stones?.length
  if (stoneCount) {
    parts.push(`${stoneCount} stone group${stoneCount === 1 ? '' : 's'}`)
  } else {
    const stone = getStoneTypeLabel(variant.stone_type)
    if (stone) parts.push(stone)
  }
  parts.push(`Stock ${variant.stock_qty}`)
  return parts.filter(Boolean).join(' · ')
}

export function ProductVariantsStep({ productId, variants = [] }) {
  const { deleteVariant } = useAdminProductMutations()
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(variants.length === 0)

  useEffect(() => {
    if (variants.length === 0) {
      setShowForm(true)
    }
  }, [variants.length, productId])

  const handleVariantSaved = async () => {
    setEditing(null)
    setShowForm(false)
  }

  const handleCancel = () => {
    setEditing(null)
    setShowForm(variants.length === 0)
  }

  const handleDelete = async (variant) => {
    if (variants.length <= 1) {
      toast.error('Every product needs at least one variant')
      return
    }
    if (!confirm(`Delete variant ${variant.sku}?`)) return
    try {
      await deleteVariant.mutateAsync({ id: variant.id, product_id: productId })
      toast.success('Variant deleted')
    } catch (err) {
      toast.error(err.message || 'Delete failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gold/20 bg-ivory-3 px-4 py-3 text-sm text-muted">
        <strong className="text-navy">Step 2 — Variants:</strong> set dimensions, then add stone groups (count, shape, size mm, setting) linked to your{' '}
        <Link to="/admin/stone-rates" className="font-medium text-gold hover:underline">stone rate card</Link>.
        Weight × rate auto-fills the stone charge.
      </div>

      {variants.length === 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/50 bg-amber-50 p-4 text-sm text-navy">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">At least one variant is required</p>
            <p className="mt-1 text-muted">
              Select size from dropdown, link stone to your rate card, then save.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {variants.map((variant) => (
          <div
            key={variant.id}
            className="flex flex-col gap-3 rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-navy">{variant.variant_label || variant.sku}</p>
              <p className="text-xs text-muted">SKU {variant.sku} · {variantSummary(variant)}</p>
              <VariantPrice variantId={variant.id} />
            </div>
            <div className="flex gap-2">
              <Badge variant={variant.is_active ? 'success' : 'muted'}>
                {variant.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => { setEditing(variant); setShowForm(true) }}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted hover:text-[#b3261e]"
                onClick={() => handleDelete(variant)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {showForm ? (
        <VariantForm
          initial={editing}
          productId={productId}
          onDone={handleVariantSaved}
          onCancel={handleCancel}
        />
      ) : (
        <Button variant="outline" onClick={() => { setEditing(null); setShowForm(true) }}>
          <Plus className="h-4 w-4" />
          Add variant
        </Button>
      )}
    </div>
  )
}
