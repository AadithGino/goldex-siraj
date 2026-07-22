import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAdminSettings, useAdminSettingsMutations } from '@/hooks/useAdminSettings'
import { useStaffRole } from '@/hooks/useStaffRole'
import { Skeleton } from '@/components/ui/skeleton'

export function AdminSettingsPage() {
  const { canManageSettings } = useStaffRole()
  const { store, tax, isLoading } = useAdminSettings()
  const { updateStore, updateTax } = useAdminSettingsMutations()
  const [storeForm, setStoreForm] = useState({})
  const [taxForm, setTaxForm] = useState({})

  useEffect(() => {
    if (store) setStoreForm(store)
    if (tax) setTaxForm(tax)
  }, [store, tax])

  if (!canManageSettings) {
    return <p className="text-muted">You don&apos;t have permission to manage settings.</p>
  }

  if (isLoading) return <Skeleton className="h-64 w-full rounded-[28px]" />

  const saveStore = async (e) => {
    e.preventDefault()
    try {
      await updateStore.mutateAsync({
        ...storeForm,
        cod_min_order: Number(storeForm.cod_min_order) || 0, // mapped to minimum_order_amount in hook
        cod_max_order: storeForm.cod_max_order ? Number(storeForm.cod_max_order) : null, // mapped to cod_max_order_amount in hook
        free_shipping_above: storeForm.free_shipping_above ? Number(storeForm.free_shipping_above) : null, // mapped to free_shipping_min_amount in hook
        flat_shipping_fee: Number(storeForm.flat_shipping_fee) || 0, // mapped to shipping_charge in hook
        return_window_days: Number(storeForm.return_window_days) || 30,
        pending_payment_minutes: Number(storeForm.pending_payment_minutes) || 30, // mapped to order_cancellation_window_minutes in hook
        cod_enabled: storeForm.cod_enabled ?? true,
        online_payment_enabled: storeForm.online_payment_enabled ?? false,
      })
      toast.success('Store settings saved')
    } catch (err) { toast.error(err.message) }
  }

  const saveTax = async (e) => {
    e.preventDefault()
    try {
      await updateTax.mutateAsync({
        vat_percent: Number(taxForm.vat_percent),
        apply_on: taxForm.apply_on,
        prices_include_vat: taxForm.prices_include_vat,
        tax_registration_number: taxForm.tax_registration_number ?? taxForm.gst_number ?? '',
        is_active: taxForm.is_active ?? true,
      })
      toast.success('Tax settings saved')
    } catch (err) { toast.error(err.message) }
  }

  return (
    <div>
      <AdminPageHeader title="Settings" description="Store configuration, shipping, VAT, and scheme toggle." />
      <Tabs defaultValue="store">
        <TabsList className="mb-6"><TabsTrigger value="store">Store</TabsTrigger><TabsTrigger value="tax">Tax & VAT</TabsTrigger></TabsList>
        <TabsContent value="store">
          <form onSubmit={saveStore} className="max-w-xl space-y-4 rounded-[28px] border border-gold/20 bg-ivory-2 p-6">
            {['store_name', 'support_phone', 'support_email', 'support_whatsapp', 'address', 'logo_url'].map((field) => (
              <div key={field}>
                <label className="mb-2 block text-sm font-medium capitalize text-navy">{field.replace(/_/g, ' ')}</label>
                <Input value={storeForm[field] || ''} onChange={(e) => setStoreForm((p) => ({ ...p, [field]: e.target.value }))} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-navy">Flat shipping fee (AED)</label>
                <Input type="number" value={storeForm.flat_shipping_fee ?? ''} onChange={(e) => setStoreForm((p) => ({ ...p, flat_shipping_fee: e.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-navy">Free shipping above (AED)</label>
                <Input type="number" value={storeForm.free_shipping_above ?? ''} onChange={(e) => setStoreForm((p) => ({ ...p, free_shipping_above: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-navy">COD minimum order (AED)</label>
                <Input type="number" min="0" value={storeForm.cod_min_order ?? ''} onChange={(e) => setStoreForm((p) => ({ ...p, cod_min_order: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-navy">COD maximum order (AED)</label>
                <Input type="number" min="0" value={storeForm.cod_max_order ?? ''} onChange={(e) => setStoreForm((p) => ({ ...p, cod_max_order: e.target.value }))} placeholder="No limit" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-navy">Return window (days)</label>
                <Input type="number" min="1" value={storeForm.return_window_days ?? 30} onChange={(e) => setStoreForm((p) => ({ ...p, return_window_days: e.target.value }))} />
                <p className="mt-1 text-xs text-muted">Days after delivery to allow return requests</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-navy">Payment timeout (minutes)</label>
                <Input type="number" min="5" value={storeForm.pending_payment_minutes ?? 30} onChange={(e) => setStoreForm((p) => ({ ...p, pending_payment_minutes: e.target.value }))} />
                <p className="mt-1 text-xs text-muted">Auto-cancel unpaid online orders after this</p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!storeForm.scheme_enabled} onChange={(e) => setStoreForm((p) => ({ ...p, scheme_enabled: e.target.checked }))} />
              Enable gold scheme module on storefront
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!storeForm.cod_enabled}
                onChange={(e) =>
                  setStoreForm((p) => ({ ...p, cod_enabled: e.target.checked }))
                }
              />
              Enable Cash on Delivery
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!storeForm.online_payment_enabled}
                onChange={(e) =>
                  setStoreForm((p) => ({ ...p, online_payment_enabled: e.target.checked }))
                }
              />
              Enable Online Payment
            </label>
            <Button type="submit" disabled={updateStore.isPending}>Save store settings</Button>
          </form>
        </TabsContent>
        <TabsContent value="tax">
          <form onSubmit={saveTax} className="max-w-xl space-y-4 rounded-[28px] border border-gold/20 bg-ivory-2 p-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">VAT percent</label>
              <Input type="number" step="0.01" value={taxForm.vat_percent ?? ''} onChange={(e) => setTaxForm((p) => ({ ...p, vat_percent: e.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">VAT applied on</label>
              <select value={taxForm.apply_on || 'total'} onChange={(e) => setTaxForm((p) => ({ ...p, apply_on: e.target.value }))}
                className="h-12 w-full rounded-full border border-gold/20 bg-ivory-2 px-4 text-sm">
                <option value="total">Total</option>
                <option value="making_only">Making charge only</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-navy">VAT / TRN registration number</label>
              <Input
                value={taxForm.tax_registration_number ?? taxForm.gst_number ?? ''}
                onChange={(e) => setTaxForm((p) => ({ ...p, tax_registration_number: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!taxForm.prices_include_vat} onChange={(e) => setTaxForm((p) => ({ ...p, prices_include_vat: e.target.checked }))} />
              Displayed prices include VAT
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={taxForm.is_active !== false}
                onChange={(e) => setTaxForm((p) => ({ ...p, is_active: e.target.checked }))}
              />
              Enable VAT / Tax calculation
            </label>
            <p className="text-xs text-muted">Making charge and wastage defaults are set per product in the Products editor.</p>
            <Button type="submit" disabled={updateTax.isPending}>Save tax settings</Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  )
}
