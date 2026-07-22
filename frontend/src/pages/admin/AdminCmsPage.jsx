import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAdminCmsPages, useAdminCmsMutations } from '@/hooks/useCmsPages'
import { CmsFormDialog } from '@/components/admin/cms/CmsFormDialog'
import { useStaffRole } from '@/hooks/useStaffRole'
import { ArabicContentBadge } from '@/components/admin/shared/LocaleFieldTabs'
import { hasArabicContent } from '@/lib/contentLocale'

export function AdminCmsPage() {
  const { canManageCatalog } = useStaffRole()
  const [page, setPage] = useState(1)
  const { data } = useAdminCmsPages({ page, limit: 25 })
  const pages = data?.data || []
  const meta = data?.meta || {}
  const totalPages = Math.max(1, meta.pages || 1)
  const { remove } = useAdminCmsMutations()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  if (!canManageCatalog) return <p className="text-muted">No permission.</p>

  return (
    <div>
      <AdminPageHeader title="CMS Pages" description="About, FAQ, policies — shown in footer and at /page/:slug."
        action={<Button onClick={() => { setEditing(null); setOpen(true) }}><Plus className="h-4 w-4" /> Add page</Button>} />
      <div className="space-y-3">
        {pages.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-navy">{p.title}</span>
                <ArabicContentBadge show={hasArabicContent(p, ['title', 'content'])} />
                <Badge variant={p.is_published ? 'success' : 'muted'}>{p.is_published ? 'Published' : 'Draft'}</Badge>
              </div>
              <p className="text-xs text-muted">/page/{p.slug}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true) }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="text-muted hover:text-[#b3261e]" onClick={async () => {
                if (!confirm('Delete page?')) return
                try { await remove.mutateAsync(p.id); toast.success('Deleted') } catch (e) { toast.error(e.message) }
              }}><Trash2 className="h-4 w-4" /></Button>
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
      <CmsFormDialog open={open} onOpenChange={setOpen} page={editing} />
    </div>
  )
}
