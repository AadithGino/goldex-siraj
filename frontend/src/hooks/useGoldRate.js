import { useMemo } from 'react'
import { useCatalogBootstrap } from '@/hooks/useCatalogBootstrap'

export function useGoldRate() {
  const bootstrap = useCatalogBootstrap()
  const data = useMemo(() => bootstrap.data?.gold_rates || [], [bootstrap.data?.gold_rates])
  return {
    ...bootstrap,
    data,
  }
}

export function useGoldBuybackRate() {
  const bootstrap = useCatalogBootstrap()
  const data = useMemo(
    () => bootstrap.data?.gold_buyback_rates || [],
    [bootstrap.data?.gold_buyback_rates],
  )
  return {
    ...bootstrap,
    data,
  }
}
