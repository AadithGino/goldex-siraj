import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration, useParams } from 'react-router-dom'
import { StorefrontLayout } from '@/components/layout/StorefrontLayout'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { RequireStaff } from '@/components/auth/RequireStaff'
import { RequireCustomer } from '@/components/auth/RequireCustomer'
import { RouteErrorBoundary } from '@/components/errors/RouteErrorBoundary'

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4 text-sm text-muted">
      Loading…
    </div>
  )
}

function lazyNamed(loader) {
  const Comp = lazy(loader)
  return function LazyRoute(props) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Comp {...props} />
      </Suspense>
    )
  }
}

const HomePage = lazyNamed(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })))
const CategoryPage = lazyNamed(() => import('@/pages/CategoryPage').then((m) => ({ default: m.CategoryPage })))
const ProductPage = lazyNamed(() => import('@/pages/ProductPage').then((m) => ({ default: m.ProductPage })))
const BrandPage = lazyNamed(() => import('@/pages/BrandPage').then((m) => ({ default: m.BrandPage })))
const SearchPage = lazyNamed(() => import('@/pages/SearchPage').then((m) => ({ default: m.SearchPage })))
const LoginPage = lazyNamed(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const WishlistPage = lazyNamed(() => import('@/pages/WishlistPage').then((m) => ({ default: m.WishlistPage })))
const CartPage = lazyNamed(() => import('@/pages/CartPage').then((m) => ({ default: m.CartPage })))
const CheckoutPage = lazyNamed(() => import('@/pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })))
const OrdersPage = lazyNamed(() => import('@/pages/OrdersPage').then((m) => ({ default: m.OrdersPage })))
const OrderDetailPage = lazyNamed(() => import('@/pages/OrderDetailPage').then((m) => ({ default: m.OrderDetailPage })))
const AccountPage = lazyNamed(() => import('@/pages/AccountPage').then((m) => ({ default: m.AccountPage })))
const CmsPage = lazyNamed(() => import('@/pages/CmsPage').then((m) => ({ default: m.CmsPage })))
const SchemePage = lazyNamed(() => import('@/pages/SchemePage').then((m) => ({ default: m.SchemePage })))
const SchemeTrackPage = lazyNamed(() => import('@/pages/SchemeTrackPage').then((m) => ({ default: m.SchemeTrackPage })))
const SchemeEnrollmentDetailPage = lazyNamed(() => import('@/pages/SchemeEnrollmentDetailPage').then((m) => ({ default: m.SchemeEnrollmentDetailPage })))
const StaffLoginPage = lazyNamed(() => import('@/pages/admin/StaffLoginPage').then((m) => ({ default: m.StaffLoginPage })))
const DashboardPage = lazyNamed(() => import('@/pages/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const AdminProductsPage = lazyNamed(() => import('@/pages/admin/AdminProductsPage').then((m) => ({ default: m.AdminProductsPage })))
const AdminProductWizardPage = lazyNamed(() => import('@/pages/admin/AdminProductWizardPage').then((m) => ({ default: m.AdminProductWizardPage })))
const AdminCategoriesPage = lazyNamed(() => import('@/pages/admin/AdminCategoriesPage').then((m) => ({ default: m.AdminCategoriesPage })))
const AdminBrandsPage = lazyNamed(() => import('@/pages/admin/AdminBrandsPage').then((m) => ({ default: m.AdminBrandsPage })))
const AdminBannersPage = lazyNamed(() => import('@/pages/admin/AdminBannersPage').then((m) => ({ default: m.AdminBannersPage })))
const AdminGoldRatesPage = lazyNamed(() => import('@/pages/admin/AdminGoldRatesPage').then((m) => ({ default: m.AdminGoldRatesPage })))
const AdminInventoryPage = lazyNamed(() => import('@/pages/admin/AdminInventoryPage').then((m) => ({ default: m.AdminInventoryPage })))
const AdminOrdersPage = lazyNamed(() => import('@/pages/admin/AdminOrdersPage').then((m) => ({ default: m.AdminOrdersPage })))
const AdminOrderDetailPage = lazyNamed(() => import('@/pages/admin/AdminOrderDetailPage').then((m) => ({ default: m.AdminOrderDetailPage })))
const AdminCouponsPage = lazyNamed(() => import('@/pages/admin/AdminCouponsPage').then((m) => ({ default: m.AdminCouponsPage })))
const AdminReviewsPage = lazyNamed(() => import('@/pages/admin/AdminReviewsPage').then((m) => ({ default: m.AdminReviewsPage })))
const AdminReturnsPage = lazyNamed(() => import('@/pages/admin/AdminReturnsPage').then((m) => ({ default: m.AdminReturnsPage })))
const AdminCustomersPage = lazyNamed(() => import('@/pages/admin/AdminCustomersPage').then((m) => ({ default: m.AdminCustomersPage })))
const AdminCustomerDetailPage = lazyNamed(() => import('@/pages/admin/AdminCustomerDetailPage').then((m) => ({ default: m.AdminCustomerDetailPage })))
const AdminSettingsPage = lazyNamed(() => import('@/pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })))
const AdminCmsPage = lazyNamed(() => import('@/pages/admin/AdminCmsPage').then((m) => ({ default: m.AdminCmsPage })))
const AdminReportsPage = lazyNamed(() => import('@/pages/admin/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })))
const AdminStaffPage = lazyNamed(() => import('@/pages/admin/AdminStaffPage').then((m) => ({ default: m.AdminStaffPage })))
const AdminStoneRatesPage = lazyNamed(() => import('@/pages/admin/AdminStoneRatesPage').then((m) => ({ default: m.AdminStoneRatesPage })))
const AdminSchemesPage = lazyNamed(() => import('@/pages/admin/AdminSchemesPage').then((m) => ({ default: m.AdminSchemesPage })))
const AdminStockLedgerPage = lazyNamed(() => import('@/pages/admin/AdminStockLedgerPage').then((m) => ({ default: m.AdminStockLedgerPage })))
const AdminAuditLogPage = lazyNamed(() => import('@/pages/admin/AdminAuditLogPage').then((m) => ({ default: m.AdminAuditLogPage })))
const AdminSchemeEnrollmentDetailPage = lazyNamed(() => import('@/pages/admin/AdminSchemeEnrollmentDetailPage').then((m) => ({ default: m.AdminSchemeEnrollmentDetailPage })))

function LegacyProductRedirect() {
  const { id } = useParams()
  return <Navigate to={`/admin/products/${id}/edit`} replace />
}

function RootLayout() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
  {
    path: '/',
    element: <StorefrontLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'category/:slug', element: <CategoryPage /> },
      { path: 'product/:slug', element: <ProductPage /> },
      { path: 'brand/:slug', element: <BrandPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'wishlist', element: <RequireCustomer><WishlistPage /></RequireCustomer> },
      { path: 'cart', element: <CartPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'orders/:id', element: <OrderDetailPage /> },
      { path: 'account', element: <AccountPage /> },
      { path: 'page/:slug', element: <CmsPage /> },
      { path: 'scheme', element: <SchemePage /> },
      { path: 'scheme/track', element: <SchemeTrackPage /> },
      { path: 'scheme/:id', element: <SchemeEnrollmentDetailPage /> },
    ],
  },
  { path: '/admin/login', element: <StaffLoginPage /> },
  {
    path: '/admin',
    element: (
      <RequireStaff>
        <AdminLayout />
      </RequireStaff>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'products', element: <AdminProductsPage /> },
      { path: 'products/new', element: <AdminProductWizardPage /> },
      { path: 'products/:id/edit', element: <AdminProductWizardPage /> },
      { path: 'products/:id', element: <LegacyProductRedirect /> },
      { path: 'categories', element: <AdminCategoriesPage /> },
      { path: 'brands', element: <AdminBrandsPage /> },
      { path: 'banners', element: <AdminBannersPage /> },
      { path: 'gold-rates', element: <AdminGoldRatesPage /> },
      { path: 'inventory', element: <AdminInventoryPage /> },
      { path: 'stock-ledger', element: <AdminStockLedgerPage /> },
      { path: 'audit-log', element: <AdminAuditLogPage /> },
      { path: 'orders', element: <AdminOrdersPage /> },
      { path: 'orders/:id', element: <AdminOrderDetailPage /> },
      { path: 'coupons', element: <AdminCouponsPage /> },
      { path: 'reviews', element: <AdminReviewsPage /> },
      { path: 'returns', element: <AdminReturnsPage /> },
      { path: 'customers', element: <AdminCustomersPage /> },
      { path: 'customers/:id', element: <AdminCustomerDetailPage /> },
      { path: 'settings', element: <AdminSettingsPage /> },
      { path: 'cms', element: <AdminCmsPage /> },
      { path: 'reports', element: <AdminReportsPage /> },
      { path: 'staff', element: <AdminStaffPage /> },
      { path: 'stone-rates', element: <AdminStoneRatesPage /> },
      { path: 'schemes', element: <AdminSchemesPage /> },
      { path: 'schemes/enrollments/:id', element: <AdminSchemeEnrollmentDetailPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
], {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  },
})

export default function App() {
  return <RouterProvider router={router} />
}
