import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
export function useAdminDashboard() { return useQuery({ queryKey: ['admin-dashboard'], queryFn: () => api.get('/admin/reports/dashboard'), staleTime: 60000 }) }
