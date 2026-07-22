import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal } from 'lucide-react'
import { ProductGrid } from '@/components/product/ProductGrid'
import { QuickViewDialog } from '@/components/product/QuickViewDialog'
import {
  DesktopFilterAside,
  FilterBar,
  applyProductFilters,
  sortProducts,
} from '@/components/product/FilterBar'
import { SortSelect } from '@/components/product/SortSelect'
import { useCategories } from '@/hooks/useCategories'
import { useBrands } from '@/hooks/useBrands'
import { useProducts } from '@/hooks/useProducts'
import { useProductPriceMap } from '@/hooks/useProductPriceMap'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

export function SearchPage() {
  const { t } = useTranslation(['product', 'common'])
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const initialOccasion = searchParams.get('occasion')
  const { data: categories } = useCategories()
  const { data: brands } = useBrands()
  const { data: products, isLoading, error } = useProducts({ search: query || undefined })
  const [filters, setFilters] = useState({
    genders: [],
    purities: [],
    occasions: initialOccasion ? [initialOccasion] : [],
    categoryId: null,
    brandId: null,
    sizes: [],
    stoneTypes: [],
    minPrice: null,
    maxPrice: null,
    minWeight: null,
    maxWeight: null,
  })
  const [sort, setSort] = useState('featured')
  const [quickViewProduct, setQuickViewProduct] = useState(null)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const { priceMap, isLoadingPrices } = useProductPriceMap(products)

  const filteredProducts = useMemo(() => {
    const filtered = applyProductFilters(products, filters, priceMap)
    return sortProducts(filtered, sort, priceMap)
  }, [products, filters, sort, priceMap])

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-8 sm:px-6">
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('product:searchEyebrow')}</p>
        <h1 className="font-display text-[clamp(24px,2.8vw,40px)] text-navy">
          {query ? t('product:searchResultsFor', { query }) : t('product:allJewellery')}
        </h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr] lg:items-start">
        <DesktopFilterAside>
          <FilterBar
            variant="sticky"
            filters={filters}
            onFiltersChange={setFilters}
            categories={categories?.filter((c) => !c.parent_id) || []}
            brands={brands || []}
            products={products || []}
            resultCount={filteredProducts.length}
            showCategoryFilter
          />
        </DesktopFilterAside>
        <div>
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3">
            <p className="text-sm text-muted">
              {isLoading || isLoadingPrices
                ? t('common:loading')
                : t('common:itemCount', { count: filteredProducts.length })}
            </p>
            <div className="flex items-center gap-2">
              <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden">
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    {t('product:filters')}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[85vh] p-0">
                  <SheetHeader className="border-b border-line px-4 pb-3 pt-5 text-left">
                    <SheetTitle>{t('product:filters')}</SheetTitle>
                    <SheetDescription>{t('product:filtersDescSearch')}</SheetDescription>
                  </SheetHeader>
                  <div className="max-h-[calc(85vh-84px)] overflow-y-auto px-4 pb-6">
                    <FilterBar
                      filters={filters}
                      onFiltersChange={setFilters}
                      categories={categories?.filter((c) => !c.parent_id) || []}
                      brands={brands || []}
                      products={products || []}
                      resultCount={filteredProducts.length}
                      showCategoryFilter
                    />
                  </div>
                </SheetContent>
              </Sheet>
              <SortSelect value={sort} onChange={setSort} />
            </div>
          </div>
          <ProductGrid
            products={filteredProducts}
            isLoading={isLoading || isLoadingPrices}
            error={error}
            onQuickView={setQuickViewProduct}
            emptyMessage={query ? t('product:noResultsFor', { query }) : t('product:noProductsFound')}
          />
        </div>
      </div>

      <QuickViewDialog
        product={quickViewProduct}
        open={!!quickViewProduct}
        onOpenChange={(open) => !open && setQuickViewProduct(null)}
      />
    </div>
  )
}
