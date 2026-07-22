import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
const PAGE_SIZE = 50
export function useAdminAuditLog({ entityType, action, page = 1 } = {}) { return useQuery({ queryKey: ['admin-audit-log', entityType, action, page], queryFn: async () => { let rows = await api.get('/admin/audit-log', { action: action && action !== 'all' ? action : undefined }); if (entityType && entityType !== 'all') rows = rows.filter((item) => item.entity_type === entityType); rows = rows.map((item) => ({ ...item, staff: item.actor_id && typeof item.actor_id === 'object' ? item.actor_id : null, details: item.metadata })); return { rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: rows.length, pageSize: PAGE_SIZE } }, staleTime: 30000 }) }
