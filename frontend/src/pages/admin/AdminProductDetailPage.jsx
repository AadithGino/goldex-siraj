import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { ProductFormDialog } from '@/components/admin/products/ProductFormDialog'
import { VariantFormDialog } from '@/components/admin/products/VariantFormDialog'
import { useAdminProduct, useAdminProductMutations } from '@/hooks/useAdminProducts'
import { useAdminCategories } from '@/hooks/useAdminCategories'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatINR } from '@/lib/pricing'
import { ProductCertificatesPanel } from '@/components/admin/products/ProductCertificatesPanel'
import { ProductImagesManager } from '@/components/admin/products/ProductImagesManager'
import { usePriceBreakup } from '@/hooks/usePriceBreakup'

function VariantPrice({ variantId }) {
  const { data } = usePriceBreakup(variantId)
  return <span className="text-sm text-gold">{data ? formatINR(data.total) : '—'}</span>
}

export function AdminProductDetailPage() {
  const { id } = useParams()
  const { data: product, isLoading, error } = useAdminProduct(id)
  const { data: categories } = useAdminCategories()
  const { deleteVariant } = useAdminProductMutations()
  const [editOpen, setEditOpen] = useState(false)
  const [variantOpen, setVariantOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState(null)

  const handleDeleteVariant = async (variant) => {
    if (!confirm(`Delete variant ${variant.sku}?`)) return
    try {
      await deleteVariant.mutateAsync({ id: variant.id, product_id: id })
      toast.success('Variant deleted')
    } catch (err) {
      toast.error(err.message || 'Delete failed')
    }
  }

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="text-center">
        <p className="text-muted">
          {String(error?.message || '').includes('Admin account not linked to staff')
            ? 'Admin account not linked to staff'
            : 'Product not found.'}
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/admin/products">Back to products</Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
        <Link to="/admin/products">
          <ChevronLeft className="h-4 w-4" />
          Products
        </Link>
      </Button>

      <AdminPageHeader
        title={product.name}
        description={`/${product.slug} · ${product.status}`}
        action={
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Edit product
          </Button>
        }
      />

      <Tabs defaultValue="variants">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="variants">Variants</TabsTrigger>
          <TabsTrigger value="images">
            Images {(product.product_images?.length || 0) > 0 && `(${product.product_images.length})`}
          </TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
        </TabsList>

        <TabsContent value="variants">
          <div className="mb-4 flex justify-end">
            <Button
              size="sm"
              onClick={() => { setEditingVariant(null); setVariantOpen(true) }}
            >
              <Plus className="h-4 w-4" />
              Add variant
            </Button>
          </div>
          <div className="space-y-3">
            {(product.product_variants || []).map((variant) => (
              <div
                key={variant.id}
                className="flex flex-col gap-3 rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-navy">{variant.variant_label || variant.sku}</p>
                  <p className="text-xs text-muted">
                    SKU {variant.sku} · {variant.weight_grams}g metal ·{' '}
                    {variant.effective_weight ?? variant.weight_grams}g billing · Stock{' '}
                    {variant.stock_qty}
                  </p>
                  <VariantPrice variantId={variant.id} />
                </div>
                <div className="flex gap-2">
                  <Badge variant={variant.is_active ? 'success' : 'muted'}>
                    {variant.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditingVariant(variant); setVariantOpen(true) }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted hover:text-[#b3261e]"
                    onClick={() => handleDeleteVariant(variant)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {!product.product_variants?.length && (
              <p className="text-sm text-muted">No variants. Add at least one buyable SKU.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="images">
          <ProductImagesManager productId={id} images={product.product_images} />
        </TabsContent>

        <TabsContent value="certificates">
          <ProductCertificatesPanel productId={id} variants={product.product_variants} />
        </TabsContent>
      </Tabs>

      <ProductFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        product={product}
        categories={categories || []}
      />
      <VariantFormDialog
        open={variantOpen}
        onOpenChange={setVariantOpen}
        productId={id}
        variant={editingVariant}
      />
    </div>
  )
}
