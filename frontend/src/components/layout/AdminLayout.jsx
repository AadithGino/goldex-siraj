import { Link, Outlet, useLocation } from 'react-router-dom'
import { BrandWordmark } from '@/components/ui/BrandLogo'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FolderTree,
  Image,
  TrendingUp,
  Warehouse,
  Tag,
  MessageSquare,
  RotateCcw,
  Users,
  FileText,
  BarChart3,
  UserCog,
  Gem,
  PiggyBank,
  ClipboardList,
  ScrollText,
  Settings,
  Store
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStaffAuth } from '@/contexts/StaffAuthContext'
import { useStoreSettings } from '@/hooks/useStoreSettings'
import { Button } from '@/components/ui/button'

const SIDEBAR_LINKS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree },
  { to: '/admin/brands', label: 'Brands', icon: Store },
  { to: '/admin/banners', label: 'Banners', icon: Image },
  { to: '/admin/gold-rates', label: 'Gold rates', icon: TrendingUp },
  { to: '/admin/inventory', label: 'Inventory', icon: Warehouse },
  { to: '/admin/stock-ledger', label: 'Stock ledger', icon: ClipboardList },
  { to: '/admin/coupons', label: 'Coupons', icon: Tag },
  { to: '/admin/reviews', label: 'Reviews', icon: MessageSquare },
  { to: '/admin/returns', label: 'Returns', icon: RotateCcw },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/cms', label: 'CMS', icon: FileText },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/audit-log', label: 'Audit log', icon: ScrollText, managerOnly: true },
  { to: '/admin/stone-rates', label: 'Stone rates', icon: Gem },
  { to: '/admin/schemes', label: 'Schemes', icon: PiggyBank, schemeOnly: true },
  { to: '/admin/staff', label: 'Staff', icon: UserCog, ownerOnly: true },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

function AdminSidebar({ schemeEnabled }) {
  const location = useLocation()
  const { role } = useStaffAuth()

  const links = SIDEBAR_LINKS.filter((link) => {
    if (link.schemeOnly && !schemeEnabled) return false
    if (link.ownerOnly && role !== 'owner') return false
    if (link.managerOnly && role !== 'owner' && role !== 'manager') return false
    return true
  })

  return (
    <aside className="hidden w-60 shrink-0 border-r border-gold/20 bg-ivory-2 md:block">
      <div className="sticky top-0 max-h-screen overflow-y-auto p-4">
        <Link to="/" className="flex items-center">
          <BrandWordmark className="h-8" />
        </Link>
        <nav className="mt-6 space-y-1">
          {links.map(({ to, label, icon: Icon, end }) => {
            const active = end ? location.pathname === to : location.pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-[var(--navy)] font-semibold text-[var(--ivory-2)] shadow-sm'
                    : 'text-[var(--navy)] hover:bg-ivory-3'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-[var(--gold-2)]' : 'text-gold'
                  )}
                />
                <span className={active ? 'text-[var(--ivory-2)]' : undefined}>{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}

function AdminMobileNav() {
  const location = useLocation()
  const tabs = [
    SIDEBAR_LINKS[0],
    SIDEBAR_LINKS[1],
    SIDEBAR_LINKS[2],
    { to: '/admin/settings', label: 'More', icon: Settings },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gold/20 bg-ivory/95 backdrop-blur-md md:hidden">
      <div className="flex items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ to, label, icon: Icon, end }) => {
          const active = end ? location.pathname === to : location.pathname.startsWith(to)
          return (
            <Link
              key={label}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-semibold',
                active ? 'text-[var(--navy)]' : 'text-muted'
              )}
            >
              <Icon className={cn('h-5 w-5', active ? 'text-gold' : 'text-muted')} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function AdminLayout() {
  const { staff, signOut } = useStaffAuth()
  const { data: settings } = useStoreSettings()

  return (
    <div className="flex min-h-screen flex-col bg-ivory md:flex-row">
      <AdminSidebar schemeEnabled={settings?.scheme_enabled} />
      <div className="flex min-h-screen flex-1 flex-col pb-16 md:pb-0">
        <header className="border-b border-gold/20 bg-ivory-2 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.12em] text-gold">Admin</p>
              <p className="text-sm text-muted">{staff?.full_name || staff?.email}{staff?.role ? ` · ${staff.role}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild><Link to="/">Storefront</Link></Button>
              <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6"><Outlet /></main>
      </div>
      <AdminMobileNav />
    </div>
  )
}
