import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'
import { Gem, Hash } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePriceBreakup } from '@/hooks/usePriceBreakup'
import { formatINR } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import { DetailCard } from '@/components/product/DetailCard'
import {
  formatMetalTypeLabel,
  getSizeTypeMeta,
  getSizeTypes,
} from '@/lib/i18nLabels'

function SpecRow({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className="flex justify-between gap-4 border-b border-gold/10 py-3 text-sm last:border-0 sm:py-3.5">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-navy">{value}</span>
    </div>
  )
}

function StoneDetailRow({ label, detail, value }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="min-w-0">
        <span className="font-medium text-navy">{label}</span>
        {detail && (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">{detail}</span>
        )}
      </span>
      <span className="shrink-0 font-medium text-gold">{value}</span>
    </div>
  )
}

function StoneGroupTable({ label, rows, breakupStones = [], t }) {
  const hasMultiple = rows.length > 1

  const chargeForRow = (row, rowIndex) => {
    if (row.charge != null && Number(row.charge) > 0) return Number(row.charge)
    if (row.id) {
      const matched = breakupStones.find((s) => s.id === row.id)
      if (matched?.charge != null) return Number(matched.charge)
    }
    const labelStones = breakupStones.filter((s) => s.label === label)
    if (labelStones[rowIndex]?.charge != null) return Number(labelStones[rowIndex].charge)
    return null
  }

  const groupTotal = rows.reduce((sum, row, i) => sum + (chargeForRow(row, i) || 0), 0)

  const rowLabel = (row, i) => {
    if (row.shape) return row.shape
    if (hasMultiple) return `${label} ${i + 1}`
    return label
  }

  const stoneRowDetail = (row) =>
    [
      row.stone_count ?? row.count
        ? t('product:stoneCount', { count: row.stone_count ?? row.count })
        : null,
      row.shape,
      row.size_mm != null ? `${Number(row.size_mm)} mm` : null,
      row.stone_weight_carat != null ? `${Number(row.stone_weight_carat)} ct` : null,
      row.setting_type,
    ]
      .filter(Boolean)
      .join(' · ')

  return (
    <div className="mt-2">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy">
        {t('product:stoneGroupDetails', { label })}
      </h3>

      {/* Mobile — stacked rows like price breakup */}
      <div className="space-y-4 sm:hidden">
        {rows.map((row, i) => {
          const charge = chargeForRow(row, i)
          return (
            <StoneDetailRow
              key={row.id || i}
              label={rowLabel(row, i)}
              detail={stoneRowDetail(row) || undefined}
              value={charge != null ? formatINR(charge) : '—'}
            />
          )
        })}
        {(hasMultiple || groupTotal > 0) && (
          <div className="flex items-center justify-between border-t border-gold/15 pt-3 text-xs">
            {hasMultiple ? (
              <span className="text-muted">
                {t('product:stoneLinesUnder', { count: rows.length, label })}
              </span>
            ) : (
              <span />
            )}
            {groupTotal > 0 && (
              <span className="font-semibold text-navy">
                {t('product:stoneGroupTotal', { label })}{' '}
                <span className="font-display text-gold">{formatINR(groupTotal)}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Desktop — table */}
      <div className="hidden overflow-x-auto rounded-xl border border-gold/15 sm:block">
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr className="border-b border-gold/15 bg-ivory-3 text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">{t('product:stoneTable.count')}</th>
              <th className="px-4 py-3 font-medium">{t('product:stoneTable.shape')}</th>
              <th className="px-4 py-3 font-medium">{t('product:stoneTable.size')}</th>
              <th className="px-4 py-3 font-medium">{t('product:weight')}</th>
              <th className="px-4 py-3 font-medium">{t('product:stoneTable.setting')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('product:stoneTable.price')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const charge = chargeForRow(row, i)
              return (
                <tr key={row.id || i} className="border-b border-gold/10 last:border-0">
                  <td className="px-4 py-3 text-navy">{row.stone_count ?? row.count ?? '—'}</td>
                  <td className="px-4 py-3 text-navy">{row.shape || '—'}</td>
                  <td className="px-4 py-3 text-navy">
                    {row.size_mm != null ? `${Number(row.size_mm)} mm` : '—'}
                  </td>
                  <td className="px-4 py-3 text-navy">
                    {row.stone_weight_carat != null ? `${Number(row.stone_weight_carat)} ct` : '—'}
                  </td>
                  <td className="px-4 py-3 text-navy">{row.setting_type || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-gold">
                    {charge != null ? formatINR(charge) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {(hasMultiple || groupTotal > 0) && (
          <div className="flex items-center justify-between border-t border-gold/10 px-4 py-2.5 text-xs">
            {hasMultiple ? (
              <span className="text-muted">
                {t('product:stoneLinesUnder', { count: rows.length, label })}
              </span>
            ) : (
              <span />
            )}
            {groupTotal > 0 && (
              <span className="font-semibold text-navy">
                {t('product:stoneGroupTotal', { label })}{' '}
                <span className="font-display text-gold">{formatINR(groupTotal)}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function groupStones(stones = []) {
  const groups = new Map()
  for (const stone of stones) {
    const label = stone.label || 'Stone'
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label).push(stone)
  }
  return groups
}

function chargeForRow(row, rowIndex, label, breakupStones) {
  if (row.charge != null && Number(row.charge) > 0) return Number(row.charge)
  if (row.id) {
    const matched = breakupStones.find((s) => s.id === row.id)
    if (matched?.charge != null) return Number(matched.charge)
  }
  const labelStones = breakupStones.filter((s) => s.label === label)
  if (labelStones[rowIndex]?.charge != null) return Number(labelStones[rowIndex].charge)
  return null
}

function stoneCardRows(label, rows, breakupStones, t) {
  const hasMultiple = rows.length > 1
  return rows.flatMap((row, i) => {
    const charge = chargeForRow(row, i, label, breakupStones)
    const rowTitle =
      row.shape || (hasMultiple ? `${label} ${i + 1}` : label)
    const specs = [
      row.stone_count ?? row.count
        ? t('product:stoneCount', { count: row.stone_count ?? row.count })
        : null,
      row.shape,
      row.size_mm != null ? `${Number(row.size_mm)} mm` : null,
      row.stone_weight_carat != null ? `${Number(row.stone_weight_carat)} ct` : null,
      row.setting_type,
    ]
      .filter(Boolean)
      .join(' · ')
    return [
      { label: rowTitle, value: specs || '—' },
      {
        label: t('product:stoneTable.price'),
        value: charge != null ? formatINR(charge) : '—',
      },
    ]
  })
}

export function ProductJewelleryDetails({ product, variant, embedded = false }) {
  const { t } = useTranslation(['product', 'common'])
  const lang = useContentLang()
  if (!variant) return null

  const { data: breakup } = usePriceBreakup(variant.id)
  const breakupStones = Array.isArray(breakup?.stones) ? breakup.stones : []

  const stones = (variant.product_stones || []).sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  )
  const legacyStone =
    stones.length === 0 && variant.stone_type && variant.stone_type !== 'none'
      ? [{
          label: variant.stone_type,
          stone_count: 1,
          shape: null,
          size_mm: null,
          setting_type: null,
          stone_weight_carat: variant.stone_weight_carat,
          charge: breakupStones[0]?.charge ?? variant.stone_charge,
        }]
      : []
  const stoneGroups = groupStones(stones.length ? stones : legacyStone)
  const metalLabel = formatMetalTypeLabel(product.purity, product.metal_type, t)
  const metalColorLabel = product.metal_color
    ? t(`product:metalColorValues.${product.metal_color}`, { defaultValue: product.metal_color })
    : null
  const brandName = product?.brands ? pickField(product.brands, 'name', lang) : null

  if (embedded) {
    const sizeMeta = getSizeTypeMeta(variant.size_type, t)
    const stockQty = variant.stock_qty
    const stoneCount = stones.reduce((s, r) => s + (Number(r.stone_count) || 0), 0)

    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
        <DetailCard
          icon={Hash}
          title={t('product:overview')}
          rows={[
            { label: t('product:sku'), value: variant.sku },
            {
              label: t('product:availability'),
              value:
                stockQty != null
                  ? stockQty > 0
                    ? t('product:inStock', { count: stockQty })
                    : t('product:outOfStock')
                  : t('product:available'),
            },
            { label: t('product:metal'), value: metalLabel },
            { label: t('product:metalColor'), value: metalColorLabel },
            { label: t('product:brand'), value: brandName },
            { label: sizeMeta.label, value: variant.size || null },
            {
              label: t('product:netWeight'),
              value:
                variant.weight_grams != null ? `${Number(variant.weight_grams)} g` : null,
            },
            {
              label: t('product:billingWeight'),
              value:
                (variant.effective_weight ?? variant.weight_grams) != null
                  ? `${Number(variant.effective_weight ?? variant.weight_grams)} g`
                  : null,
            },
            {
              label: t('product:height'),
              value: variant.height_mm != null ? `${Number(variant.height_mm)} mm` : null,
            },
            {
              label: t('product:width'),
              value: variant.width_mm != null ? `${Number(variant.width_mm)} mm` : null,
            },
            {
              label: t('product:stones'),
              value: stoneCount > 0 ? t('product:stoneCount', { count: stoneCount }) : null,
            },
          ]}
        />

        {[...stoneGroups.entries()].map(([label, rows]) => (
          <DetailCard
            key={label}
            icon={Gem}
            title={label}
            rows={stoneCardRows(label, rows, breakupStones, t)}
          />
        ))}
      </div>
    )
  }

  const content = (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-navy">{t('product:productDetails')}</h3>
        <SpecRow label={t('product:productCode')} value={variant.sku} />
        <SpecRow
          label={t('product:height')}
          value={variant.height_mm != null ? `${Number(variant.height_mm)} mm` : null}
        />
        <SpecRow
          label={t('product:width')}
          value={variant.width_mm != null ? `${Number(variant.width_mm)} mm` : null}
        />
      </div>

      {[...stoneGroups.entries()].map(([label, rows]) => (
        <StoneGroupTable
          key={label}
          label={label}
          rows={rows}
          breakupStones={breakupStones}
          t={t}
        />
      ))}

      <div className="border-t border-gold/10 pt-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy">
          {t('product:metalDetails')}
        </h3>
        <SpecRow label={t('product:type')} value={metalLabel} />
        <SpecRow label={t('product:metalColor')} value={metalColorLabel} />
        <SpecRow label={t('product:brand')} value={brandName} />
        <SpecRow
          label={t('product:weight')}
          value={
            variant.weight_grams != null
              ? t('product:weightGramSingular', { weight: Number(variant.weight_grams) })
              : null
          }
        />
        <SpecRow
          label={t('product:billingWeight')}
          value={
            (variant.effective_weight ?? variant.weight_grams) != null
              ? t('product:weightGramSingular', {
                  weight: Number(variant.effective_weight ?? variant.weight_grams),
                })
              : null
          }
        />
      </div>
    </div>
  )

  return (
    <div className="rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-6">
      <h2 className="font-display text-lg text-navy">{t('product:specifications')}</h2>
      <div className="mt-3">{content}</div>
    </div>
  )
}

export function ProductCustomizationBlock({
  product,
  customizationRequest,
  onCustomizationChange,
  embedded = false,
}) {
  const { t } = useTranslation('product')
  const lang = useContentLang()
  const customizationNote = pickField(product, 'customization_note', lang)
  if (!product?.is_customizable) return null

  return (
    <div
      className={
        embedded
          ? 'rounded-2xl border border-gold/15 bg-ivory-2 p-4 sm:p-5'
          : 'rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-6'
      }
    >
      <h2 className="font-display text-base text-navy sm:text-lg">{t('customizationTitle')}</h2>
      {customizationNote && (
        <p className="mt-2 text-sm leading-relaxed text-muted">{customizationNote}</p>
      )}
      <div className="mt-4 border-t border-gold/10 pt-4 sm:mt-5 sm:pt-5">
        <label htmlFor="customization-request" className="block text-sm font-medium text-navy">
          {t('customizationLabel')}
        </label>
        <textarea
          id="customization-request"
          value={customizationRequest}
          onChange={(e) => onCustomizationChange(e.target.value)}
          rows={3}
          placeholder={t('customizationPlaceholder')}
          className="mt-3 w-full resize-y rounded-2xl border border-gold/20 bg-ivory px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-gold/30"
        />
      </div>
    </div>
  )
}

export function variantPickerLabel(variant, t) {
  if (!variant) return '—'
  const pricingWeight = variant.effective_weight ?? variant.weight_grams
  const fallbackLabel =
    variant.purity && pricingWeight != null ? `${variant.purity.toUpperCase()} / ${pricingWeight}g` : null
  return (
    variant.variant_label ||
    variant.label ||
    variant.size_label ||
    fallbackLabel ||
    variant.sku ||
    t('common:selectVariant')
  )
}

function SizeChip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-[30px] min-w-9 rounded border px-2 py-1 text-xs font-medium transition-colors',
        selected
          ? 'border-navy bg-navy text-white'
          : 'border-line bg-white text-ink hover:border-gold/40'
      )}
    >
      {children}
    </button>
  )
}

export function VariantSizeSelector({ variants, selectedId, onSelect, compact = false }) {
  const { t } = useTranslation(['product', 'common'])
  const sizeTypesList = useMemo(() => getSizeTypes(t), [t])

  const sizeTypes = useMemo(
    () => [...new Set(variants.map((v) => v.size_type || 'other'))],
    [variants]
  )

  const selected = variants.find((v) => v.id === selectedId) || variants[0]
  const [sizeType, setSizeType] = useState(selected?.size_type || 'other')
  const [size, setSize] = useState(selected?.size || '')

  useEffect(() => {
    const v = variants.find((x) => x.id === selectedId)
    if (!v) return
    const nextType = v.size_type || 'other'
    const nextSize = v.size || ''
    setSizeType((prev) => (prev === nextType ? prev : nextType))
    setSize((prev) => (prev === nextSize ? prev : nextSize))
  }, [selectedId, variants])

  const sizesForType = useMemo(
    () =>
      [...new Set(variants.filter((v) => v.size_type === sizeType).map((v) => v.size).filter(Boolean))].sort(),
    [variants, sizeType]
  )

  const pickVariant = (match) => {
    if (match && match.id !== selectedId) onSelect(match.id)
  }

  const handleSizeTypeChange = (nextType) => {
    setSizeType(nextType)
    const nextSize = variants.find((x) => x.size_type === nextType)?.size || ''
    setSize(nextSize)
    pickVariant(variants.find((x) => x.size_type === nextType && x.size === nextSize))
  }

  const handleSizeChange = (nextSize) => {
    setSize(nextSize)
    pickVariant(variants.find((v) => v.size_type === sizeType && v.size === nextSize))
  }

  if (!variants.length) return null

  const labelClass = compact
    ? 'mb-1 text-[11px] font-medium uppercase tracking-wide text-muted'
    : 'mb-2 text-sm font-medium text-navy'
  const triggerClass = compact
    ? '!min-h-0 h-8 rounded-md px-2.5 text-xs'
    : undefined
  const useSizeChips = compact && sizesForType.length > 0 && sizesForType.length <= 16

  if (variants.length === 1) {
    const variant = variants[0]
    if (!variant.size && !variant.variant_label) return null

    return (
      <div>
        {variant.size && (
          <>
            <p className={labelClass}>
              {t('product:sizeTypeSize', { sizeType: getSizeTypeMeta(variant.size_type, t).label })}
            </p>
            <span className="inline-flex rounded border border-line bg-ivory-3 px-2.5 py-1 text-xs font-semibold text-navy">
              {variant.size}
            </span>
          </>
        )}
      </div>
    )
  }

  const hasSizedVariants = variants.some((v) => v.size)
  const sizeTypeLabel = getSizeTypeMeta(sizeType, t).label
  const validSelectedId = variants.some((v) => v.id === selectedId) ? selectedId : undefined

  if (hasSizedVariants && sizesForType.length > 0) {
    return (
      <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
        <div className={compact ? 'grid grid-cols-1 gap-2.5 sm:grid-cols-2' : 'space-y-3'}>
          {sizeTypes.length > 1 && (
            <div>
              <p className={labelClass}>{t('product:type')}</p>
              <Select value={sizeType} onValueChange={handleSizeTypeChange}>
                <SelectTrigger className={triggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sizeTypes.map((typeValue) => {
                    const meta = sizeTypesList.find((s) => s.value === typeValue) || { label: typeValue }
                    return (
                      <SelectItem key={typeValue} value={typeValue}>
                        {meta.label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className={sizeTypes.length > 1 ? '' : 'sm:col-span-2'}>
            <p className={labelClass}>{t('product:sizeTypeSize', { sizeType: sizeTypeLabel })}</p>
            {useSizeChips ? (
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pt-0.5">
                {sizesForType.map((s) => (
                  <SizeChip
                    key={s}
                    selected={size === s}
                    onClick={() => handleSizeChange(s)}
                  >
                    {s}
                  </SizeChip>
                ))}
              </div>
            ) : (
              <Select value={size || undefined} onValueChange={handleSizeChange}>
                <SelectTrigger className={triggerClass}>
                  <SelectValue placeholder={t('common:select')} />
                </SelectTrigger>
                <SelectContent>
                  {sizesForType.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className={labelClass}>{t('product:variant')}</p>
      <Select value={validSelectedId} onValueChange={onSelect}>
        <SelectTrigger className={triggerClass}>
          <SelectValue placeholder={t('common:selectVariant')} />
        </SelectTrigger>
        <SelectContent>
          {variants.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {variantPickerLabel(v, t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
