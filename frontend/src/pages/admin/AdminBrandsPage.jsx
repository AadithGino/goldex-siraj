import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminBrands, useAdminBrandMutations } from '@/hooks/useAdminBrands'
import { BrandFormDialog } from '@/components/admin/brands/BrandFormDialog'
import { ArabicContentBadge } from '@/components/admin/shared/LocaleFieldTabs'
import { hasArabicContent } from '@/lib/contentLocale'
import { brandLogoUrl } from '@/lib/catalogPayloads'

export function AdminBrandsPage() {
  const { data: brands, isLoading } = useAdminBrands()
  const { remove } = useAdminBrandMutations()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const handleDelete = async (brand) => {
    if (!confirm(`Delete brand "${brand.name}"?`)) return
    try {
      await remove.mutateAsync(brand.id)
      toast.success('Brand deleted')
    } catch (error) {
      toast.error(error.message || 'Delete failed')
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Brands"
        description="Manage brand profiles, logos, and banners."
        action={
          <Button onClick={() => { setEditing(null); setOpen(true) }}>
            <Plus className="h-4 w-4" />
            Add brand
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-[28px]" />
      ) : (
        <div className="space-y-3">
          {(brands || []).map((brand) => (
            <div
              key={brand.id}
              className="flex flex-col gap-4 rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ivory-3">
                  {brandLogoUrl(brand) ? (
                    <img
                      src={brandLogoUrl(brand)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-display text-gold">{brand.name?.charAt(0)}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-navy">{brand.name}</p>
                    <ArabicContentBadge
                      show={hasArabicContent(brand, ['name', 'description'])}
                    />
                    <Badge variant={brand.is_active ? 'success' : 'muted'}>
                      {brand.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted">/{brand.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setEditing(brand); setOpen(true) }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted hover:text-[#b3261e]"
                  onClick={() => handleDelete(brand)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {!brands?.length && (
            <p className="text-sm text-muted">No brands yet.</p>
          )}
        </div>
      )}

      <BrandFormDialog open={open} onOpenChange={setOpen} brand={editing} />
    </div>
  )
}
