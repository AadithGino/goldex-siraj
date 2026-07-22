import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
function adapt(row) { return row ? { ...row, scheme_enabled: row.gold_scheme_enabled ?? true, cod_max_order: row.cod_max_order_amount, cod_min_order: row.cod_min_order_amount, flat_shipping_fee: row.shipping_fee, shipping_charge: row.shipping_fee, free_shipping_above: row.free_shipping_threshold, free_shipping_min_amount: row.free_shipping_threshold } : row }
export function useStoreSettings() { return useQuery({ queryKey: ['store-settings'], queryFn: async () => adapt((await api.get('/customer/catalog/bootstrap')).settings), staleTime: 600000 }) }
