import { useMemo } from 'react'
import { normalizeStoreBranches } from '@/lib/storeBranches'
import { useCatalogBootstrap } from '@/hooks/useCatalogBootstrap'
function adapt(row, payments) {
  if (!row) return row
  return {
    ...row,
    branches: normalizeStoreBranches(row),
    scheme_enabled: row.gold_scheme_enabled ?? true,
    cod_max_order: row.cod_max_order_amount,
    cod_min_order: row.cod_min_order_amount,
    flat_shipping_fee: row.shipping_fee,
    shipping_charge: row.shipping_fee,
    free_shipping_above: row.free_shipping_threshold,
    free_shipping_min_amount: row.free_shipping_threshold,
    online_checkout_enabled: payments?.online_checkout_enabled === true,
    online_checkout_provider: payments?.online_checkout_provider || null,
    paymob_configured: payments?.paymob_configured === true,
    tabby_configured: payments?.tabby_configured === true,
  }
}
export function useStoreSettings() {
  const bootstrap = useCatalogBootstrap()
  const data = useMemo(
    () => adapt(bootstrap.data?.settings, bootstrap.data?.payments),
    [bootstrap.data?.settings, bootstrap.data?.payments],
  )
  return {
    ...bootstrap,
    data,
  }
}
