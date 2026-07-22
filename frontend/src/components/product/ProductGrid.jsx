import { PackageOpen } from 'lucide-react'
import { ProductCard } from '@/components/product/ProductCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

export function ProductGrid({ products, isLoading, error, onQuickView, emptyMessage }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/5] w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[28px] border border-gold/20 bg-ivory-2 p-8 text-center">
        <p className="text-muted">Failed to load products. Please try again.</p>
      </div>
    )
  }

  if (!products?.length) {
    return (
      <div className="flex flex-col items-center rounded-[28px] border border-gold/20 bg-ivory-2 px-6 py-12 text-center">
        <PackageOpen className="h-10 w-10 text-gold" />
        <p className="mt-4 font-display text-xl text-navy">
          {emptyMessage || 'No products found'}
        </p>
        <Button asChild className="mt-4" variant="outline">
          <a href="/search">Browse all jewellery</a>
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onQuickView={onQuickView} />
      ))}
    </div>
  )
}
