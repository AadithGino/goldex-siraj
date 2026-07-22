import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PURITIES,
  getStoneTypeLabel,
  formatSizeFilterKey,
  parseSizeFilterKey,
  extractCatalogFilterOptions,
  getProductsForFilterOptions,
  syncVariantFilters,
} from '@/lib/constants'
import {
  getGenders,
  getWeightPresets,
  getOccasions,
  normalizeGender,
  getSizeTypeMeta,
} from '@/lib/i18nLabels'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** A single reference-style checkbox row. */
function CheckRow({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1.5 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 rounded-[3px] accent-[var(--navy)]"
      />
      <span className="truncate">{label}</span>
    </label>
  )
}

function Section({ title, children }) {
  return (
    <div className="border-b border-line py-5">
      <h3 className="mb-2 text-base font-semibold text-navy">{title}</h3>
      {children}
    </div>
  )
}

const ALL_VALUE = '__all__'

/** Desktop listing: sticky sidebar capped to viewport, scrolls when filters are tall */
export function DesktopFilterAside({ children }) {
  return (
    <div className="hidden lg:block lg:sticky lg:top-[var(--storefront-header-height)] lg:z-20 lg:max-h-[calc(100vh-var(--storefront-header-height)-2rem)] lg:self-start lg:overflow-y-auto lg:overscroll-y-contain lg:pr-1">
      {children}
    </div>
  )
}

function FilterSelect({ label, value, onChange, options, placeholder }) {
  const selectValue = value != null ? String(value) : ALL_VALUE
  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="text-sm font-semibold text-navy">{label}</span>
      <Select
        value={selectValue}
        onValueChange={(v) => onChange(v === ALL_VALUE ? null : v)}
      >
        <SelectTrigger className="h-9 w-full rounded-lg text-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{placeholder}</SelectItem>
          {options.map((opt) => (
            <SelectItem key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function FilterBar({
  filters,
  onFiltersChange,
  categories = [],
  brands = [],
  products = [],
  showCategoryFilter = false,
  showBrandFilter = true,
  resultCount,
  variant = 'sidebar',
}) {
  const { t } = useTranslation(['product', 'common'])
  const lang = useContentLang()
  const [showAllCats, setShowAllCats] = useState(false)
  const [priceSel, setPriceSel] = useState([])
  const [weightSel, setWeightSel] = useState([])

  const pricePresets = useMemo(
    () => [
      { label: t('product:price.under500'), min: null, max: 500 },
      { label: t('product:price.500to1000'), min: 500, max: 1000 },
      { label: t('product:price.1000to2500'), min: 1000, max: 2500 },
      { label: t('product:price.2500to5000'), min: 2500, max: 5000 },
      { label: t('product:price.5000to10000'), min: 5000, max: 10000 },
      { label: t('product:price.over10000'), min: 10000, max: null },
    ],
    [t]
  )

  const weightPresets = useMemo(() => getWeightPresets(t), [t])
  const genders = useMemo(() => getGenders(t), [t])
  const occasionLabels = useMemo(
    () => Object.fromEntries(getOccasions(t).map((o) => [o.key, o.label])),
    [t]
  )

  const scopedProducts = useMemo(
    () => getProductsForFilterOptions(products, filters),
    [products, filters.categoryId, filters.brandId]
  )
  const catalogOptions = useMemo(
    () => extractCatalogFilterOptions(scopedProducts),
    [scopedProducts]
  )

  const occasions = useMemo(() => {
    const set = new Set()
    ;(products || []).forEach((p) => (p.occasion || []).forEach((o) => o && set.add(o)))
    return Array.from(set)
  }, [products])

  const availableGenders = useMemo(() => {
    const set = new Set()
    for (const p of products) {
      if (p.gender) set.add(normalizeGender(p.gender))
    }
    return genders.filter((g) => set.has(g.value))
  }, [products, genders])

  const updateFilters = (patch) => {
    const next = { ...filters, ...patch }
    if ('categoryId' in patch) {
      const scoped = getProductsForFilterOptions(products, next)
      const options = extractCatalogFilterOptions(scoped)
      onFiltersChange(syncVariantFilters(next, options))
      return
    }
    onFiltersChange(next)
  }

  const toggleInArray = (key, value) => {
    const current = filters[key] || []
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    updateFilters({ [key]: next })
  }

  const togglePrice = (index) => {
    const next = priceSel.includes(index)
      ? priceSel.filter((i) => i !== index)
      : [...priceSel, index]
    setPriceSel(next)
    if (!next.length) {
      updateFilters({ minPrice: null, maxPrice: null })
      return
    }
    const chosen = next.map((i) => pricePresets[i])
    const mins = chosen.map((c) => (c.min == null ? 0 : c.min))
    const hasOpenMax = chosen.some((c) => c.max == null)
    const maxs = chosen.map((c) => c.max).filter((m) => m != null)
    updateFilters({
      minPrice: Math.min(...mins) || null,
      maxPrice: hasOpenMax ? null : Math.max(...maxs),
    })
  }

  const formatSizeLabel = (key) => {
    const { sizeType, size } = parseSizeFilterKey(key)
    return `${getSizeTypeMeta(sizeType, t).label} ${size}`
  }

  const visibleCats = showAllCats ? categories : categories.slice(0, 5)
  const hasActive =
    filters.categoryId ||
    filters.brandId ||
    filters.genders?.length ||
    filters.purities?.length ||
    filters.occasions?.length ||
    filters.sizes?.length ||
    filters.stoneTypes?.length ||
    filters.minPrice != null ||
    filters.maxPrice != null ||
    filters.minWeight != null ||
    filters.maxWeight != null

  const setSingleArrayFilter = (key, value) => {
    updateFilters({ [key]: value ? [value] : [] })
  }

  const activePricePreset = useMemo(() => {
    if (filters.minPrice == null && filters.maxPrice == null) return null
    const idx = pricePresets.findIndex(
      (p) => p.min === filters.minPrice && p.max === filters.maxPrice
    )
    return idx >= 0 ? String(idx) : null
  }, [filters.minPrice, filters.maxPrice, pricePresets])

  const setPricePreset = (value) => {
    if (!value) {
      setPriceSel([])
      updateFilters({ minPrice: null, maxPrice: null })
      return
    }
    const index = Number(value)
    setPriceSel([index])
    const preset = pricePresets[index]
    updateFilters({ minPrice: preset.min, maxPrice: preset.max })
  }

  const activeWeightPreset = useMemo(() => {
    if (filters.minWeight == null && filters.maxWeight == null) return null
    const idx = weightPresets.findIndex(
      (p) => p.min === filters.minWeight && p.max === filters.maxWeight
    )
    return idx >= 0 ? String(idx) : null
  }, [filters.minWeight, filters.maxWeight, weightPresets])

  const setWeightPreset = (value) => {
    if (!value) {
      setWeightSel([])
      updateFilters({ minWeight: null, maxWeight: null })
      return
    }
    const index = Number(value)
    setWeightSel([index])
    const preset = weightPresets[index]
    updateFilters({ minWeight: preset.min, maxWeight: preset.max })
  }

  const toggleWeight = (index) => {
    const next = weightSel.includes(index)
      ? weightSel.filter((i) => i !== index)
      : [...weightSel, index]
    setWeightSel(next)
    if (!next.length) {
      updateFilters({ minWeight: null, maxWeight: null })
      return
    }
    const chosen = next.map((i) => weightPresets[i])
    const mins = chosen.map((c) => (c.min == null ? 0 : c.min))
    const hasOpenMax = chosen.some((c) => c.max == null)
    const maxs = chosen.map((c) => c.max).filter((m) => m != null)
    updateFilters({
      minWeight: Math.min(...mins) || null,
      maxWeight: hasOpenMax ? null : Math.max(...maxs),
    })
  }

  const clearAllFilters = () => {
    setPriceSel([])
    setWeightSel([])
    onFiltersChange({
      ...filters,
      categoryId: null,
      brandId: null,
      genders: [],
      purities: [],
      occasions: [],
      sizes: [],
      stoneTypes: [],
      minPrice: null,
      maxPrice: null,
      minWeight: null,
      maxWeight: null,
    })
  }

  if (variant === 'sticky') {
    return (
      <aside className="text-ink">
        {resultCount != null && (
          <div className="border-b border-line pb-4">
            <p className="text-sm text-muted">{t('common:resultCount', { count: resultCount })}</p>
          </div>
        )}
        <div className="space-y-5 py-1">
          {showCategoryFilter && categories.length > 0 && (
            <FilterSelect
              label={t('product:filter.category')}
              value={filters.categoryId}
              onChange={(id) => updateFilters({ categoryId: id })}
              options={categories.map((cat) => ({
                value: String(cat.id),
                label: pickField(cat, 'name', lang),
              }))}
              placeholder={t('common:all')}
            />
          )}
          {showBrandFilter && brands.length > 0 && (
            <FilterSelect
              label={t('product:filter.brand')}
              value={filters.brandId}
              onChange={(id) => updateFilters({ brandId: id })}
              options={brands.map((brand) => ({
                value: String(brand.id),
                label: pickField(brand, 'name', lang),
              }))}
              placeholder={t('common:all')}
            />
          )}
          {availableGenders.length > 0 && (
            <FilterSelect
              label={t('product:filter.gender')}
              value={filters.genders?.[0] ?? null}
              onChange={(v) => setSingleArrayFilter('genders', v)}
              options={availableGenders.map((g) => ({
                value: g.value,
                label: g.label,
              }))}
              placeholder={t('common:all')}
            />
          )}
          <FilterSelect
            label={t('product:filter.purity')}
            value={filters.purities?.[0] ?? null}
            onChange={(v) => setSingleArrayFilter('purities', v)}
            options={PURITIES.map((purity) => ({
              value: purity,
              label: purity.toUpperCase(),
            }))}
            placeholder={t('common:all')}
          />
          {occasions.length > 0 && (
            <FilterSelect
              label={t('product:filter.occasion')}
              value={filters.occasions?.[0] ?? null}
              onChange={(v) => setSingleArrayFilter('occasions', v)}
              options={occasions.map((o) => ({
                value: o,
                label: occasionLabels[o] || o,
              }))}
              placeholder={t('common:all')}
            />
          )}
          {catalogOptions.stoneTypes.length > 0 && (
            <FilterSelect
              label={t('product:filter.stone')}
              value={filters.stoneTypes?.[0] ?? null}
              onChange={(v) => setSingleArrayFilter('stoneTypes', v)}
              options={catalogOptions.stoneTypes.map((stone) => ({
                value: stone,
                label: getStoneTypeLabel(stone) || stone,
              }))}
              placeholder={t('common:all')}
            />
          )}
          {catalogOptions.sizes.length > 0 && (
            <FilterSelect
              label={t('product:filter.size')}
              value={filters.sizes?.[0] ?? null}
              onChange={(v) => setSingleArrayFilter('sizes', v)}
              options={catalogOptions.sizes.map((key) => ({
                value: key,
                label: formatSizeLabel(key),
              }))}
              placeholder={t('common:all')}
            />
          )}
          <FilterSelect
            label={t('product:filter.priceRange')}
            value={activePricePreset}
            onChange={setPricePreset}
            options={pricePresets.map((p, i) => ({
              value: String(i),
              label: p.label,
            }))}
            placeholder={t('common:all')}
          />
          <FilterSelect
            label={t('product:filter.weight')}
            value={activeWeightPreset}
            onChange={setWeightPreset}
            options={weightPresets.map((p, i) => ({
              value: String(i),
              label: p.label,
            }))}
            placeholder={t('common:all')}
          />
          {hasActive && (
            <button
              type="button"
              className="text-sm font-semibold text-gold hover:underline"
              onClick={clearAllFilters}
            >
              {t('product:clearAllFilters')}
            </button>
          )}
        </div>
      </aside>
    )
  }

  return (
    <aside className="text-ink">
      {resultCount != null && (
        <div className="border-b border-line pb-4">
          <p className="text-sm text-muted">{t('common:resultCount', { count: resultCount })}</p>
        </div>
      )}

      {showCategoryFilter && categories.length > 0 && (
        <Section title={t('product:filter.category')}>
          <div>
            {visibleCats.map((cat) => (
              <CheckRow
                key={cat.id}
                label={pickField(cat, 'name', lang)}
                checked={filters.categoryId === cat.id}
                onChange={() =>
                  updateFilters({ categoryId: filters.categoryId === cat.id ? null : cat.id })
                }
              />
            ))}
          </div>
          {categories.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllCats((v) => !v)}
              className="mt-1 text-sm font-medium text-gold hover:underline"
            >
              {showAllCats
                ? t('common:showLess')
                : t('common:showMoreCount', { count: categories.length - 5 })}
            </button>
          )}
        </Section>
      )}
      {showBrandFilter && brands.length > 0 && (
        <Section title={t('product:filter.brand')}>
          {brands.map((brand) => (
            <CheckRow
              key={brand.id}
              label={pickField(brand, 'name', lang)}
              checked={filters.brandId === brand.id}
              onChange={() =>
                updateFilters({ brandId: filters.brandId === brand.id ? null : brand.id })
              }
            />
          ))}
        </Section>
      )}

      {(availableGenders.length > 0 || genders.length > 0) && (
        <Section title={t('product:filter.gender')}>
          {(availableGenders.length ? availableGenders : genders).map((g) => (
            <CheckRow
              key={g.value}
              label={g.label}
              checked={filters.genders?.includes(g.value)}
              onChange={() => toggleInArray('genders', g.value)}
            />
          ))}
        </Section>
      )}

      <Section title={t('product:filter.purity')}>
        {PURITIES.map((purity) => (
          <CheckRow
            key={purity}
            label={purity.toUpperCase()}
            checked={filters.purities?.includes(purity)}
            onChange={() => toggleInArray('purities', purity)}
          />
        ))}
      </Section>

      {occasions.length > 0 && (
        <Section title={t('product:filter.occasion')}>
          {occasions.map((o) => (
            <CheckRow
              key={o}
              label={occasionLabels[o] || o}
              checked={filters.occasions?.includes(o)}
              onChange={() => toggleInArray('occasions', o)}
            />
          ))}
        </Section>
      )}

      {catalogOptions.stoneTypes.length > 0 && (
        <Section title={t('product:filter.stone')}>
          {catalogOptions.stoneTypes.map((stone) => (
            <CheckRow
              key={stone}
              label={getStoneTypeLabel(stone) || stone}
              checked={filters.stoneTypes?.includes(stone)}
              onChange={() => toggleInArray('stoneTypes', stone)}
            />
          ))}
        </Section>
      )}

      {catalogOptions.sizes.length > 0 && (
        <Section title={t('product:filter.size')}>
          <div className="max-h-44 overflow-y-auto pr-1">
            {catalogOptions.sizes.map((key) => (
              <CheckRow
                key={key}
                label={formatSizeLabel(key)}
                checked={filters.sizes?.includes(key)}
                onChange={() => toggleInArray('sizes', key)}
              />
            ))}
          </div>
        </Section>
      )}

      <Section title={t('product:filter.priceRange')}>
        {pricePresets.map((p, i) => (
          <CheckRow
            key={p.label}
            label={p.label}
            checked={priceSel.includes(i)}
            onChange={() => togglePrice(i)}
          />
        ))}
      </Section>

      <Section title={t('product:filter.weight')}>
        {weightPresets.map((p, i) => (
          <CheckRow
            key={p.label}
            label={p.label}
            checked={weightSel.includes(i)}
            onChange={() => toggleWeight(i)}
          />
        ))}
      </Section>

      {hasActive && (
        <button
          type="button"
          className="mt-4 text-sm font-semibold text-gold hover:underline"
          onClick={clearAllFilters}
        >
          {t('product:clearAllFilters')}
        </button>
      )}
    </aside>
  )
}

function variantMatchesFilters(variants, filters) {
  if (!variants?.length) return false

  return variants.some((v) => {
    if (filters.sizes?.length) {
      const key = formatSizeFilterKey(v.size_type, v.size)
      if (!filters.sizes.includes(key)) return false
    }
    if (filters.stoneTypes?.length && !filters.stoneTypes.includes(v.stone_type)) return false
    if (filters.minWeight != null || filters.maxWeight != null) {
      const weight = Number(v.weight_grams)
      if (!weight || Number.isNaN(weight)) return false
      if (filters.minWeight != null && weight < filters.minWeight) return false
      if (filters.maxWeight != null && weight > filters.maxWeight) return false
    }
    return true
  })
}

export function applyProductFilters(products, filters, priceMap = {}) {
  if (!products) return []

  return products.filter((product) => {
    if (filters.purities?.length && !filters.purities.includes(product.purity)) {
      return false
    }

    if (filters.occasions?.length) {
      const productOccasions = product.occasion || []
      if (!filters.occasions.some((o) => productOccasions.includes(o))) {
        return false
      }
    }

    if (filters.categoryId && product.category_id !== filters.categoryId) {
      return false
    }

    if (filters.brandId && product.brand_id !== filters.brandId) {
      return false
    }

    if (filters.genders?.length) {
      const productGender = normalizeGender(product.gender)
      if (!filters.genders.includes(productGender)) {
        return false
      }
    }

    const hasVariantFilters =
      filters.sizes?.length ||
      filters.stoneTypes?.length ||
      filters.minWeight != null ||
      filters.maxWeight != null

    if (hasVariantFilters && !variantMatchesFilters(product.product_variants, filters)) {
      return false
    }

    const variants = product.product_variants || []
    const prices = variants
      .map((v) => priceMap[v.id])
      .filter((p) => p != null)

    if (filters.minPrice != null || filters.maxPrice != null) {
      if (!prices.length) return true
      const minProductPrice = Math.min(...prices)
      const maxProductPrice = Math.max(...prices)
      if (filters.minPrice != null && maxProductPrice < filters.minPrice) return false
      if (filters.maxPrice != null && minProductPrice > filters.maxPrice) return false
    }

    return true
  })
}

export function sortProducts(products, sort, priceMap = {}) {
  const list = [...(products || [])]

  const minPrice = (product) => {
    const prices = (product.product_variants || [])
      .map((v) => priceMap[v.id])
      .filter((p) => p != null)
    return prices.length ? Math.min(...prices) : Infinity
  }

  switch (sort) {
    case 'price_asc':
      return list.sort((a, b) => minPrice(a) - minPrice(b))
    case 'price_desc':
      return list.sort((a, b) => minPrice(b) - minPrice(a))
    case 'newest':
      return list.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    case 'featured':
    default:
      return list.sort((a, b) => Number(b.is_featured) - Number(a.is_featured))
  }
}
