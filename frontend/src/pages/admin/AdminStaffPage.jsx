import { useState } from 'react'
import { Plus, Trash2, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAdminStaff, useAdminStaffMutations } from '@/hooks/useAdminStaff'
import { useStaffRole } from '@/hooks/useStaffRole'
import { useStaffAuth } from '@/contexts/StaffAuthContext'

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner — full access' },
  { value: 'manager', label: 'Manager — manage catalog, orders, settings' },
  { value: 'staff', label: 'Staff — view orders and customers' },
]

function AddStaffForm({ onSuccess, onCancel }) {
  const { create } = useAdminStaffMutations()
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'staff' })

  const handleCreate = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) {
      toast.error('Initial password must be at least 8 characters.')
      return
    }
    try {
      await create.mutateAsync(form)
      toast.success('Staff member added.')
      onSuccess()
    } catch (err) { toast.error(err.message) }
  }

  return (
    <div className="mb-6 max-w-lg rounded-[28px] border border-gold/20 bg-ivory-2 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-navy">Add staff member</h3>
        <Button variant="ghost" size="icon" onClick={onCancel}><X className="h-4 w-4" /></Button>
      </div>

      <form onSubmit={handleCreate} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Full name <span className="text-[#b3261e]">*</span></label>
          <Input
            value={form.full_name}
            onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
            placeholder="Full name"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Email</label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="Email address"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Initial password <span className="text-[#b3261e]">*</span></label>
          <Input type="password" minLength={8} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="At least 8 characters" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Role</label>
          <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="submit">Add staff member</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}

function EditStaffRow({ staff, onCancel }) {
  const { update } = useAdminStaffMutations()
  const [form, setForm] = useState({ full_name: staff.full_name, email: staff.email, role: staff.role })

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      await update.mutateAsync({ id: staff.id, ...form })
      toast.success('Updated')
      onCancel()
    } catch (err) { toast.error(err.message) }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3 rounded-[28px] border border-gold/40 bg-ivory-3 p-4">
      <div className="min-w-[160px] flex-1">
        <label className="mb-1 block text-xs font-medium text-muted">Name</label>
        <Input
          value={form.full_name}
          onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
          required
          className="h-9 text-sm"
        />
      </div>
      <div className="min-w-[180px] flex-1">
        <label className="mb-1 block text-xs font-medium text-muted">Email</label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          className="h-9 text-sm"
        />
      </div>
      <div className="w-44">
        <label className="mb-1 block text-xs font-medium text-muted">Role</label>
        <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v }))}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">Save</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

export function AdminStaffPage() {
  const { canManageStaff } = useStaffRole()
  const { staff: currentStaff } = useStaffAuth()
  const { data: staffList } = useAdminStaff()
  const { update, remove } = useAdminStaffMutations()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)

  if (!canManageStaff) {
    return <p className="text-muted">Only owners can manage staff accounts.</p>
  }

  return (
    <div>
      <AdminPageHeader
        title="Staff"
        description="Manage admin access levels. New staff sign in at /admin/login with the email and initial password you provide."
        action={
          !showForm && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" /> Add staff
            </Button>
          )
        }
      />

      {showForm && (
        <AddStaffForm
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="space-y-3">
        {staffList?.map((s) => {
          if (editingId === s.id) {
            return <EditStaffRow key={s.id} staff={s} onCancel={() => setEditingId(null)} />
          }

          const isMe = s.id === currentStaff?.id
          const isSoleOwner = s.role === 'owner' && staffList.filter((x) => x.role === 'owner').length === 1

          return (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-5"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-navy">{s.full_name}</span>
                  <Badge variant="gold">{s.role}</Badge>
                  {!s.is_active && <Badge variant="destructive">Inactive</Badge>}
                  {isMe && <Badge variant="muted">You</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-muted">{s.email}</p>
              </div>
              {!isSoleOwner && (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingId(s.id)}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await update.mutateAsync({ id: s.id, is_active: !s.is_active })
                        toast.success(s.is_active ? 'Deactivated' : 'Activated')
                      } catch (e) { toast.error(e.message) }
                    }}
                  >
                    {s.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  {!isMe && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted hover:text-[#b3261e]"
                      onClick={async () => {
                        if (!confirm(`Remove ${s.full_name} from staff?`)) return
                        try { await remove.mutateAsync(s.id); toast.success('Removed') } catch (e) { toast.error(e.message) }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
