import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
export function useAdminStaff() { return useQuery({ queryKey: ['admin-staff'], queryFn: () => api.get('/admin/staff') }) }
export function useAdminStaffMutations() { const queryClient = useQueryClient(); const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-staff'] }); const create = useMutation({ mutationFn: (body) => api.post('/admin/staff', body), onSuccess: invalidate }); const update = useMutation({ mutationFn: ({ id, ...body }) => api.patch(`/admin/staff/${id}`, body), onSuccess: invalidate }); const remove = useMutation({ mutationFn: (id) => api.delete(`/admin/staff/${id}`), onSuccess: invalidate }); return { create, update, remove } }
