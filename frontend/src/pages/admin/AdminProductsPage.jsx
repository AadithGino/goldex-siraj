import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Copy, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAdminProducts, useAdminProductMutations } from '@/hooks/useAdminProducts'
import { useAdminCategories } from '@/hooks/useAdminCategories'
import { ArabicContentBadge } from '@/components/admin/shared/LocaleFieldTabs'
import { hasArabicContent } from '@/lib/contentLocale'

const PAGE_SIZE = 20

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
]

export function AdminProductsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useAdminProducts({ page, limit: PAGE_SIZE, search: search || undefined })
  const products = data?.items || []
  const meta = data?.meta || { page: 1, pages: 1, total: 0, limit: PAGE_SIZE }
  const { data: categories } = useAdminCategories()
  const { deleteProduct, duplicateProduct } = useAdminProductMutations()

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    try {
      await deleteProduct.mutateAsync(id)
      toast.success('Product deleted')
    } catch (err) {
      toast.error(err.message || 'Delete failed')
    }
  }

  const handleDuplicate = async (id, name) => {
    try {
      const newProduct = await duplicateProduct.mutateAsync(id)
      toast.success(`"${name}" duplicated as draft`)
      navigate(`/admin/products/${newProduct.id}/edit`)
    } catch (err) {
      toast.error(err.message || 'Duplicate failed')
    }
  }

  const filtered = products.filter((p) => {
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    const matchCat = categoryFilter === 'all' || p.category_id === categoryFilter
    return matchStatus && matchCat
  })

  const totalPages = Math.max(1, meta.pages || 1)
  const paginated = filtered

  const handleFilterChange = (setter) => (val) => {
    setter(val)
    setPage(1)
  }

  return (
    <div>
      <AdminPageHeader
        title="Products"
        description="Add and manage catalogue with the step-by-step product wizard."
        action={
          <Button onClick={() => navigate('/admin/products/new')}>
            <Plus className="h-4 w-4" />
            Add product
          </Button>
        }
      />

      {/* Search + filters */}
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search products…"
            className="pl-9"
          />
        </div>

        {/* Status pills */}
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => handleFilterChange(setStatusFilter)(f.value)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                statusFilter === f.value
                  ? 'border-[var(--navy)] bg-[var(--navy)] text-[var(--ivory-2)]'
                  : 'border-gold/30 text-navy hover:border-gold'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Category filter */}
        {categories?.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => handleFilterChange(setCategoryFilter)(e.target.value)}
            className="h-10 rounded-full border border-gold/20 bg-ivory-2 px-3 text-sm text-navy"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[28px]" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-[28px] border border-gold/20 bg-ivory-2 p-8 text-center text-sm text-muted">
          {String(error?.message || '').includes('Admin account not linked to staff')
            ? 'Admin account not linked to staff'
            : 'Failed to load products'}
        </div>
      ) : !paginated.length ? (
        <div className="rounded-[28px] border border-gold/20 bg-ivory-2 p-8 text-center text-sm text-muted">
          {search || statusFilter !== 'all' || categoryFilter !== 'all'
            ? 'No products match your filters.'
            : 'No products yet. '}
          {!search && statusFilter === 'all' && categoryFilter === 'all' && (
            <button
              type="button"
              className="font-semibold text-gold hover:underline"
              onClick={() => navigate('/admin/products/new')}
            >
              Add your first product
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted">
            {filtered.length} product{filtered.length !== 1 ? 's' : ''}
            {filtered.length !== (products?.length || 0) && ` (filtered from ${products?.length})`}
          </p>
          <div className="space-y-3">
            {paginated.map((product) => {
              const image = product.product_images?.find((i) => i.is_primary)?.url || product.product_images?.[0]?.url
              const variantCount = product.product_variants?.length || 0
              return (
                <div
                  key={product.id}
                  className="flex flex-col gap-4 rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:flex-row sm:items-center sm:p-5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-ivory-3">
                      {image ? (
                        <img src={image} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/admin/products/${product.id}/edit`}
                          className="font-display text-lg text-navy hover:text-gold"
                        >
                          {product.name}
                        </Link>
                        <ArabicContentBadge
                          show={hasArabicContent(product, [
                            'name',
                            'short_desc',
                            'description',
                            'customization_note',
                          ])}
                        />
                        <Badge variant={product.status === 'active' ? 'success' : 'muted'}>
                          {product.status}
                        </Badge>
                        {product.is_featured && <Badge variant="gold">Featured</Badge>}
                        {variantCount === 0 && <Badge variant="muted">No variants</Badge>}
                      </div>
                      <p className="text-xs text-muted">
                        {product.categories?.name || 'Uncategorised'}
                        {product.brands?.name ? ` · ${product.brands.name}` : ''}
                        {' · '}
                        {variantCount} variant
                        {variantCount === 1 ? '' : 's'} · {product.purity?.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/admin/products/${product.id}/edit`}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Duplicate product"
                      onClick={() => handleDuplicate(product.id, product.name)}
                      disabled={duplicateProduct.isPending}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted hover:text-[#b3261e]"
                      onClick={() => handleDelete(product.id, product.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs text-muted">
                Page {page} of {totalPages} · {filtered.length} products
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
