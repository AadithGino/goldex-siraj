import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { normalizeStoneRates } from '@/lib/rateAdapters'

export function useAdminStoneRates() {
  return useQuery({
    queryKey: ['admin-stone-rates'],
    queryFn: async () => normalizeStoneRates(await api.get('/admin/rates/stone')),
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

export function useAdminStoneRateMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-stone-rates'] })
    qc.invalidateQueries({ queryKey: ['stone-rates'] })
  }

  const saveStone = useMutation({
    mutationFn: ({ stone_type, grade, rate_per_unit, unit }) =>
      api.post('/admin/rates/stone', { stone_type, grade, rate: rate_per_unit, unit: unit || 'carat' }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/admin/rates/stone/${id}`),
    onSuccess: invalidate,
  })

  const removeStone = useMutation({
    mutationFn: async ({ stone_type, grade, unit }) => {
      const rows = normalizeStoneRates(await api.get('/admin/rates/stone'))
      await Promise.all(
        rows
          .filter((row) => row.stone_type === stone_type && row.grade === grade && row.unit === unit && !row.is_current)
          .map((row) => api.delete(`/admin/rates/stone/${row.id}`)),
      )
    },
    onSuccess: invalidate,
  })

  return { saveStone, remove, removeStone }
}
