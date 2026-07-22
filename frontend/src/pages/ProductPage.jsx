import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ChevronRight,
  Star,
  ShieldCheck,
  Truck,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { getDefaultVariant, useProductBySlug } from '@/hooks/useProducts'
import { ProductImageGallery } from '@/components/product/ProductImageGallery'
import { ProductPriceSummary } from '@/components/product/ProductPriceSummary'
import { ProductPriceBreakupPanel } from '@/components/product/ProductPriceBreakupPanel'
import { MobileProductActionBar } from '@/components/product/MobileProductActionBar'
import { CertificateBadges } from '@/components/product/CertificateBadges'
import { ReviewList } from '@/components/product/ReviewList'
import { ReviewForm } from '@/components/product/ReviewForm'
import { AddToBagButton } from '@/components/product/AddToBagButton'
import { WishlistButton } from '@/components/product/WishlistButton'
import {
  ProductJewelleryDetails,
  ProductCustomizationBlock,
  VariantSizeSelector,
} from '@/components/product/ProductJewelleryDetails'
import { SimilarProducts } from '@/components/product/SimilarProducts'
import { certificatesForVariant } from '@/lib/certificates'
import { formatMetalTypeLabel } from '@/lib/i18nLabels'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

function Assurance({ icon: Icon, title, sub }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-line bg-white px-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
      <span>
        <span className="block text-xs font-semibold text-navy">{title}</span>
        <span className="block text-[11px] leading-snug text-muted">{sub}</span>
      </span>
    </div>
  )
}

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function ProductPage() {
  const { t } = useTranslation(['product', 'common', 'nav'])
  const lang = useContentLang()
  const { slug } = useParams()
  const { data: product, isLoading, error } = useProductBySlug(slug)
  const [selectedVariantId, setSelectedVariantId] = useState(null)
  const [customizationRequest, setCustomizationRequest] = useState('')

  const variants = product?.product_variants || []
  const defaultVariant = getDefaultVariant(product)
  const activeVariantId = selectedVariantId || defaultVariant?.id
  const activeVariant = variants.find((v) => v.id === activeVariantId)
  const certs = certificatesForVariant(product?.certificates, activeVariantId)

  const metalBadge = useMemo(
    () => (product ? formatMetalTypeLabel(product.purity, product.metal_type, t) : null),
    [product, t]
  )
  const metalColorBadge = useMemo(
    () =>
      product?.metal_color
        ? t(`product:metalColorValues.${product.metal_color}`, { defaultValue: product.metal_color })
        : null,
    [product, t]
  )

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Skeleton className="h-5 w-48" />
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-[480px] w-full" />
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-3xl text-navy">{t('product:notFound')}</h1>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/search">{t('common:browseJewellery')}</Link>
        </Button>
      </div>
    )
  }

  const showVariantBox =
    variants.length > 1 || variants.some((v) => v.size || v.variant_label)

  const showLongDescription =
    pickField(product, 'description', lang).trim() !== pickField(product, 'short_desc', lang).trim()

  const productName = pickField(product, 'name', lang)
  const brandName = product?.brands ? pickField(product.brands, 'name', lang) : null
  const categoryName = product.categories ? pickField(product.categories, 'name', lang) : null
  const productDescription = pickField(product, 'description', lang)
  const productShortDesc = pickField(product, 'short_desc', lang)
  const isOutOfStock = !activeVariantId || Number(activeVariant?.stock_qty ?? 0) <= 0

  return (
    <div className="bg-white pb-32 md:pb-0">
      {/* Breadcrumb */}
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6">
        <nav className="flex flex-wrap items-center gap-1 text-xs text-muted">
          <Link to="/" className="hover:text-gold">
            {t('nav:home')}
          </Link>
          <ChevronRight className="h-3 w-3" />
          {product.categories && (
            <>
              <Link to={`/category/${product.categories.slug}`} className="hover:text-gold">
                {categoryName}
              </Link>
              <ChevronRight className="h-3 w-3" />
            </>
          )}
          <span className="line-clamp-1 text-navy">{productName}</span>
        </nav>
      </div>

      {/* Main two-column PDP */}
      <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-14">
        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10 xl:gap-14">
          {/* Left — gallery */}
          <div>
            <ProductImageGallery
              images={product.product_images}
              videoUrl={product.video_url}
              productName={productName}
            />
          </div>

          {/* Right — buy box */}
          <div className="lg:sticky lg:top-[calc(var(--storefront-header-height)+1rem)] lg:self-start">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {metalBadge && <Badge variant="navy">{metalBadge}</Badge>}
                  {metalColorBadge && <Badge variant="outline">{metalColorBadge}</Badge>}
                  {product.is_featured && <Badge variant="gold">{t('product:featuredBadge')}</Badge>}
                  {product.is_customizable && <Badge variant="gold">{t('product:customizableBadge')}</Badge>}
                </div>
                <h1 className="mt-2 font-display text-2xl leading-tight text-navy sm:text-3xl lg:text-[2rem]">
                  {productName}
                </h1>
                {brandName && (
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
                    {t('product:brand')}:{' '}
                    {product?.brands?.slug ? (
                      <Link to={`/brand/${product.brands.slug}`} className="text-gold hover:underline">
                        {brandName}
                      </Link>
                    ) : (
                      brandName
                    )}
                  </p>
                )}
              </div>
              <WishlistButton
                productId={product.id}
                className="h-10 w-10 shrink-0 rounded-full border border-line bg-white hover:border-gold/40"
                iconClassName="h-[18px] w-[18px]"
              />
            </div>

            {activeVariant?.sku && (
              <p className="mt-2 text-xs text-muted">
                {t('product:skuLabel')}{' '}
                <span className="font-medium text-ink">{activeVariant.sku}</span>
                <button
                  type="button"
                  onClick={() => scrollToId('specifications')}
                  className="ml-3 font-semibold text-gold hover:underline"
                >
                  {t('product:viewDetails')}
                </button>
              </p>
            )}

            {product.rating_count > 0 && (
              <button
                type="button"
                onClick={() => scrollToId('reviews')}
                className="mt-2 flex items-center gap-1 text-sm text-muted hover:text-gold"
              >
                <Star className="h-4 w-4 fill-gold text-gold" />
                {t('product:ratingSummary', {
                  rating: Number(product.rating_avg).toFixed(1),
                  count: product.rating_count,
                })}
              </button>
            )}

            {productShortDesc && (
              <p className="mt-3 text-sm leading-relaxed text-muted">{productShortDesc}</p>
            )}

            {/* Price */}
            <div className="mt-5 border-t border-line pt-5">
              <ProductPriceSummary variantId={activeVariantId} />
              <button
                type="button"
                onClick={() => scrollToId('price-breakup')}
                className="mt-2 text-xs font-semibold text-gold hover:underline"
              >
                {t('product:priceBreakUp')}
              </button>
            </div>

            {/* Variant selectors */}
            {showVariantBox && (
              <div className="mt-4 border-t border-line pt-4">
                <VariantSizeSelector
                  variants={variants}
                  selectedId={activeVariantId}
                  onSelect={setSelectedVariantId}
                  compact
                />
              </div>
            )}

            {/* Add to bag */}
            <div className="mt-6">
              <AddToBagButton
                variantId={activeVariantId}
                customizationRequest={
                  product.is_customizable ? customizationRequest : undefined
                }
                className="w-full min-h-[52px] rounded-sm text-base font-semibold"
              />
            </div>

            {/* Certificates strip */}
            {certs.length > 0 && (
              <button
                type="button"
                onClick={() => scrollToId('price-breakup')}
                className="mt-5 flex w-full items-center gap-3 rounded-lg border border-line bg-ivory-3 px-4 py-3 text-left transition-colors hover:border-gold/30"
              >
                <ShieldCheck className="h-5 w-5 shrink-0 text-gold" />
                <div className="min-w-0 flex-1">
                  <CertificateBadges certificates={certs} variantId={activeVariantId} size="xs" />
                </div>
                <span className="shrink-0 text-xs font-semibold text-gold">{t('common:viewArrow')}</span>
              </button>
            )}

            {/* Trust assurances */}
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Assurance
                icon={ShieldCheck}
                title={t('product:assurance.certifiedTitle')}
                sub={t('product:assurance.certifiedSub')}
              />
              <Assurance
                icon={Truck}
                title={t('product:assurance.codTitle')}
                sub={t('product:assurance.codSub')}
              />
              <Assurance
                icon={RefreshCw}
                title={t('product:assurance.exchangeTitle')}
                sub={t('product:assurance.exchangeSub')}
              />
              <Assurance
                icon={Sparkles}
                title={t('product:assurance.madeToOrderTitle')}
                sub={t('product:assurance.madeToOrderSub')}
              />
            </div>

            <ProductCustomizationBlock
              product={product}
              customizationRequest={customizationRequest}
              onCustomizationChange={setCustomizationRequest}
              embedded
            />
          </div>
        </div>
      </div>

      {/* Lower detail sections */}
      <div className="border-t border-line bg-ivory-3/60">
        <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:space-y-12 sm:px-6 sm:py-12">
          {/* Specifications (overview + stone breakdown) */}
          <section id="specifications" className="scroll-mt-[calc(var(--storefront-header-height)+1rem)]">
            <h2 className="mb-4 font-display text-xl text-navy sm:mb-5 sm:text-2xl">
              {t('product:specifications')}
            </h2>
            <ProductJewelleryDetails product={product} variant={activeVariant} embedded />
          </section>

          {/* Description — only when different from short summary above the fold */}
          {showLongDescription && (
            <section id="about" className="scroll-mt-[calc(var(--storefront-header-height)+1rem)]">
              <h2 className="mb-4 font-display text-xl text-navy sm:text-2xl">
                {t('product:description')}
              </h2>
              <div className="rounded-xl border border-line bg-white p-5 sm:p-6">
                <p className="whitespace-pre-line text-sm leading-[1.85] text-muted sm:text-base">
                  {productDescription}
                </p>
              </div>
            </section>
          )}

          {/* Price breakup + certifications (expand for full details) */}
          <ProductPriceBreakupPanel
            variantId={activeVariantId}
            productId={product.id}
            certificates={product.certificates}
            id="price-breakup"
          />

          {certs.length === 0 && (
            <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted sm:px-5">
              {t('product:certOnRequest')}
            </p>
          )}

          {/* Similar products */}
          <SimilarProducts product={product} limit={4} />

          {/* Reviews */}
          <section id="reviews" className="scroll-mt-[calc(var(--storefront-header-height)+1rem)]">
            <h2 className="mb-5 font-display text-xl text-navy sm:text-2xl">{t('product:reviews')}</h2>
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">
              <div className="rounded-xl border border-line bg-white p-5 sm:p-6">
                <h3 className="mb-4 text-sm font-semibold text-navy">{t('product:writeReview')}</h3>
                <ReviewForm productId={product.id} embedded />
              </div>
              <div className="flex min-h-[260px] flex-col rounded-xl border border-line bg-white p-5 sm:min-h-[300px] sm:p-6">
                <h3 className="mb-4 text-sm font-semibold text-navy">{t('product:customerReviews')}</h3>
                <ReviewList productId={product.id} embedded />
              </div>
            </div>
          </section>
        </div>
      </div>

      <MobileProductActionBar
        variantId={activeVariantId}
        customizationRequest={product.is_customizable ? customizationRequest : undefined}
        isOutOfStock={isOutOfStock}
      />
    </div>
  )
}
