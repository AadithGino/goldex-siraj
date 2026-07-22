import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminCategories, useAdminCategoryMutations } from '@/hooks/useAdminCategories'
import { CategoryFormDialog } from '@/components/admin/categories/CategoryFormDialog'
import { ArabicContentBadge } from '@/components/admin/shared/LocaleFieldTabs'
import { hasArabicContent } from '@/lib/contentLocale'

export function AdminCategoriesPage() {
  const { data: categories, isLoading } = useAdminCategories()
  const { remove } = useAdminCategoryMutations()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const handleDelete = async (cat) => {
    if (!confirm(`Delete category "${cat.name}"?`)) return
    try {
      await remove.mutateAsync(cat.id)
      toast.success('Category deleted')
    } catch (err) {
      toast.error(err.message || 'Delete failed')
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Categories"
        description="Organise your catalogue."
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4" />
            Add category
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-[28px]" />
      ) : (
        <div className="space-y-3">
          {(categories || []).map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between gap-4 rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-5"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-ivory-3">
                  {cat.image_url ? (
                    <img src={cat.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-display text-gold">{cat.name.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-navy">
                    {cat.name}
                    <ArabicContentBadge
                      show={hasArabicContent(cat, ['name', 'description'])}
                      className="ml-2"
                    />
                  </p>
                  <p className="text-xs text-muted">/{cat.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={cat.is_active ? 'success' : 'muted'}>
                  {cat.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setEditing(cat); setFormOpen(true) }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted hover:text-[#b3261e]"
                  onClick={() => handleDelete(cat)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editing}
        categories={categories || []}
      />
    </div>
  )
}
