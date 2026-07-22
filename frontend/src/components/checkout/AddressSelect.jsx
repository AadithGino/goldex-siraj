import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAddressLabels } from '@/lib/i18nLabels'
import { Button } from '@/components/ui/button'
import { AddressForm } from '@/components/account/AddressForm'
import { AddressDisplay } from '@/components/shared/AddressDisplay'

function resolveAddressLabel(label, t) {
  const normalized = String(label || 'home').toLowerCase()
  const match = getAddressLabels(t).find((item) => item.value === normalized)
  return match?.label || label
}

export function AddressSelect({
  addresses,
  selectedId,
  onSelect,
  showForm,
  onToggleForm,
  onSaveAddress,
  isSaving,
}) {
  const { t } = useTranslation(['checkout', 'common'])

  if (!addresses.length && !showForm) {
    return (
      <div className="rounded-lg border border-line bg-white p-6 text-center">
        <p className="text-sm text-muted">{t('checkout:noSavedAddresses')}</p>
        <Button className="mt-4" size="sm" onClick={onToggleForm}>
          <Plus className="h-4 w-4" />
          {t('checkout:addAddress')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {addresses.map((address) => (
        <button
          key={address.id}
          type="button"
          onClick={() => onSelect(address.id)}
          className={cn(
            'w-full rounded-lg border p-3 text-left transition-colors',
            selectedId === address.id
              ? 'border-navy bg-ivory-3 ring-1 ring-navy/10'
              : 'border-line bg-white hover:border-navy/30'
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gold">
              {resolveAddressLabel(address.label, t)}
            </span>
            {address.is_default && (
              <span className="rounded bg-navy px-1.5 py-0.5 text-[10px] font-semibold text-gold-3">
                {t('common:default')}
              </span>
            )}
          </div>
          <div className="mt-2">
            <AddressDisplay address={address} />
          </div>
        </button>
      ))}

      {showForm ? (
        <div className="rounded-lg border border-line bg-white p-3">
          <h3 className="text-sm font-semibold text-navy">{t('checkout:newUaeAddress')}</h3>
          <div className="mt-3">
            <AddressForm
              onSubmit={onSaveAddress}
              onCancel={onToggleForm}
              isSaving={isSaving}
              submitLabel={t('common:saveAndUse')}
            />
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={onToggleForm}>
          <Plus className="h-4 w-4" />
          {t('checkout:addNewAddress')}
        </Button>
      )}
    </div>
  )
}
