import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminBanners, useAdminBannerMutations } from '@/hooks/useAdminBanners'
import { BannerFormDialog } from '@/components/admin/banners/BannerFormDialog'
import { formatBannerSize, getBannerSpec, BANNER_POSITIONS } from '@/lib/bannerSpecs'
import { ArabicContentBadge } from '@/components/admin/shared/LocaleFieldTabs'
import { hasArabicContent } from '@/lib/contentLocale'

const POSITION_LABELS = Object.fromEntries(
  BANNER_POSITIONS.map((p) => [p, p.replace(/_/g, ' ')]),
)

export function AdminBannersPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useAdminBanners({ page, limit: 25 })
  const banners = data?.data || []
  const meta = data?.meta || {}
  const totalPages = Math.max(1, meta.pages || 1)
  const { remove } = useAdminBannerMutations()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const handleDelete = async (banner) => {
    if (!confirm(`Delete banner "${banner.title}"?`)) return
    try {
      await remove.mutateAsync(banner.id)
      toast.success('Banner deleted')
    } catch (err) {
      toast.error(err.message || 'Delete failed')
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Banners"
        description="Upload separate desktop and mobile wide images per slot. Storefront shows image-only creatives."
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4" />
            Add banner
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-[28px]" />
      ) : (
        <div className="space-y-3">
          {banners.map((banner) => (
            <div
              key={banner.id}
              className="flex flex-col gap-4 rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:flex-row sm:items-center sm:p-5"
            >
              <div className="flex shrink-0 gap-2">
                {banner.image_url && (
                  <div className="text-center">
                    <img src={banner.image_url} alt="" className="h-16 w-28 rounded-lg border border-line object-cover" />
                    <p className="mt-1 text-[10px] text-muted">EN Desktop</p>
                  </div>
                )}
                {(banner.mobile_image_url || banner.image_url) && (
                  <div className="text-center">
                    <img src={banner.mobile_image_url || banner.image_url} alt="" className="h-16 w-28 rounded-lg border border-line object-cover" />
                    <p className="mt-1 text-[10px] text-muted">EN Mobile wide</p>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-navy">{banner.title}</p>
                  <ArabicContentBadge show={hasArabicContent(banner, ['title', 'image_url', 'mobile_image_url'])} />
                  <Badge variant="gold">{POSITION_LABELS[banner.position] || banner.position}</Badge>
                  <Badge variant={banner.is_active ? 'success' : 'muted'}>
                    {banner.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Desktop {formatBannerSize(getBannerSpec(banner.position).desktop)} · Mobile{' '}
                  {formatBannerSize(getBannerSpec(banner.position).mobile)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => { setEditing(banner); setFormOpen(true) }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-muted hover:text-[#b3261e]" onClick={() => handleDelete(banner)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted">Page {meta.page || page} of {totalPages} · {meta.total ?? 0} total</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      )}

      <BannerFormDialog open={formOpen} onOpenChange={setFormOpen} banner={editing} />
    </div>
  )
}
