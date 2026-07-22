import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export const TAX_TREATMENT_OPTIONS = [
  {
    value: 'standard',
    label: 'Standard VAT-rated jewellery',
  },
  {
    value: 'investment_precious_metal_zero_rated',
    label: 'Zero-rated investment precious metal',
  },
]

export function TaxTreatmentField({
  value = 'standard',
  onChange,
  purity,
  jewelleryType,
  allowInherit = false,
}) {
  const resolvedValue = allowInherit && !value ? '__inherit__' : value || 'standard'
  const isZeroRated = resolvedValue === 'investment_precious_metal_zero_rated'
  const purityOk = String(purity || '').toLowerCase() === '24k'
  const typeOk = ['bar', 'coin'].includes(String(jewelleryType || '').toLowerCase())
  const showWarning = isZeroRated && (!purityOk || !typeOk)

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-navy">VAT treatment</label>
      <Select
        value={resolvedValue}
        onValueChange={(v) => onChange(v === '__inherit__' ? '' : v)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowInherit && (
            <SelectItem value="__inherit__">Inherit from product</SelectItem>
          )}
          {TAX_TREATMENT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-1 text-xs text-muted">
        Use zero-rated only for eligible 24K/99%+ investment bars or coins. Finished jewellery
        remains VAT-rated even if 24K.
      </p>
      {showWarning && (
        <p className="mt-2 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-navy">
          Zero-rated requires 24K purity and jewellery type bar or coin. This item may still be
          taxed at checkout until corrected.
        </p>
      )}
    </div>
  )
}
