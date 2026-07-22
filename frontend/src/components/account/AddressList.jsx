import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { AddressForm } from '@/components/account/AddressForm'
import { AddressDisplay } from '@/components/shared/AddressDisplay'
import { useAddresses } from '@/hooks/useAddresses'
import { getAddressLabels } from '@/lib/i18nLabels'

function resolveAddressLabel(label, t) {
  const normalized = String(label || 'home').toLowerCase()
  const match = getAddressLabels(t).find((item) => item.value === normalized)
  return match?.label || label
}

export function AddressList() {
  const { t } = useTranslation(['checkout', 'common', 'errors'])
  const { addresses, isLoading, create, update, remove, isSaving } = useAddresses()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  const handleCreate = async (form) => {
    try {
      await create(form)
      toast.success(t('common:addressSaved'))
      setShowForm(false)
    } catch (err) {
      toast.error(err.message || t('errors:checkout.saveAddressFailed'))
    }
  }

  const handleUpdate = async (form) => {
    try {
      await update({ id: editing.id, ...form })
      toast.success(t('common:addressUpdated'))
      setEditing(null)
    } catch (err) {
      toast.error(err.message || t('errors:account.updateAddressFailed'))
    }
  }

  const handleDelete = async (id) => {
    try {
      await remove(id)
      toast.success(t('common:addressRemoved'))
    } catch (err) {
      toast.error(err.message || t('errors:account.removeAddressFailed'))
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted">{t('common:loadingAddresses')}</p>
  }

  return (
    <div className="space-y-2">
      {addresses.map((address) =>
        editing?.id === address.id ? (
          <div key={address.id} className="rounded-lg border border-line bg-white p-3">
            <AddressForm
              initial={address}
              onSubmit={handleUpdate}
              onCancel={() => setEditing(null)}
              isSaving={isSaving}
            />
          </div>
        ) : (
          <div
            key={address.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-line bg-white p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-gold">
                  {resolveAddressLabel(address.label, t)}
                </span>
                {address.is_default && (
                  <span className="rounded bg-navy px-1.5 py-0.5 text-[10px] font-semibold text-gold-3">
                    {t('common:default')}
                  </span>
                )}
              </div>
              <div className="mt-1.5">
                <AddressDisplay address={address} />
              </div>
            </div>
            <div className="flex shrink-0 gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 min-h-0"
                onClick={() => setEditing(address)}
                aria-label={t('common:editAddressAria')}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 min-h-0 text-muted hover:text-[#b3261e]"
                onClick={() => handleDelete(address.id)}
                aria-label={t('common:deleteAddressAria')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )
      )}

      {showForm ? (
        <div className="rounded-lg border border-line bg-white p-3">
          <AddressForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            isSaving={isSaving}
          />
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          {t('checkout:address.addUaeAddress')}
        </Button>
      )}
    </div>
  )
}
