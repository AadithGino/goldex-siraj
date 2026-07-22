import { useStaffAuth } from '@/contexts/StaffAuthContext'

export function useStaffRole() {
  const { role } = useStaffAuth()
  return {
    role,
    isOwner: role === 'owner',
    isManager: role === 'manager',
    isStaff: role === 'staff',
    canManageCatalog: role === 'owner' || role === 'manager',
    canManageStaff: role === 'owner',
    canManageSettings: role === 'owner' || role === 'manager',
    canRecordPayments: role === 'owner' || role === 'manager',
  }
}
