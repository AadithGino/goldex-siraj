import { useMemo } from 'react'
import { useCatalogBootstrap } from '@/hooks/useCatalogBootstrap'

export function useStoneRates() {
  const bootstrap = useCatalogBootstrap()
  const data = useMemo(
    () => (bootstrap.data?.stone_rates || []).map((row) => ({ ...row, rate_per_unit: row.rate })),
    [bootstrap.data?.stone_rates],
  )
  return {
    ...bootstrap,
    data,
  }
}
