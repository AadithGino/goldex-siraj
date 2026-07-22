import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
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
import { useBrandBySlug, useBrands } from '@/hooks/useBrands'
import { useProducts } from '@/hooks/useProducts'
import { useProductPriceMap } from '@/hooks/useProductPriceMap'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

export function BrandPage() {
  const { t } = useTranslation(['product', 'common'])
  const lang = useContentLang()
  const { slug } = useParams()
  const { data: brand, isLoading: brandLoading } = useBrandBySlug(slug)
  const { data: brands } = useBrands()
  const { data: products, isLoading, error } = useProducts({ brandId: brand?.id })
  const [filters, setFilters] = useState({
    genders: [],
    purities: [],
    occasions: [],
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

  if (brandLoading) {
    return (
      <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    )
  }

  if (!brand) {
    return (
      <div className="mx-auto max-w-[1320px] px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-3xl text-navy">{t('product:brandNotFound')}</h1>
        <p className="mt-2 text-muted">{t('product:brandNotFoundDesc')}</p>
      </div>
    )
  }

  const brandName = pickField(brand, 'name', lang)
  const brandDescription = pickField(brand, 'description', lang)
  const banner = brand.banner_desktop_url || brand.banner_tablet_url || brand.banner_mobile_url

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-8 sm:px-6">
      {banner && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-gold/20 bg-ivory-2">
          <img src={banner} alt={brandName} className="aspect-[16/7] w-full object-cover" />
        </div>
      )}
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('product:brandEyebrow')}</p>
        <h1 className="font-display text-[clamp(24px,2.8vw,40px)] text-navy">{brandName}</h1>
        {brandDescription && (
          <p className="mt-2 max-w-2xl text-sm text-muted">{brandDescription}</p>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr] lg:items-start">
        <DesktopFilterAside>
          <FilterBar
            filters={filters}
            onFiltersChange={setFilters}
            brands={brands || []}
            products={products || []}
            resultCount={filteredProducts.length}
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
                    <SheetDescription>{t('product:filtersDescCategory')}</SheetDescription>
                  </SheetHeader>
                  <div className="max-h-[calc(85vh-84px)] overflow-y-auto px-4 pb-6">
                    <FilterBar
                      filters={filters}
                      onFiltersChange={setFilters}
                      brands={brands || []}
                      products={products || []}
                      resultCount={filteredProducts.length}
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
            emptyMessage={t('product:noProductsInBrand', { brand: brandName })}
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
