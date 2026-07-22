import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { TopBar } from '@/components/layout/TopBar'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { MobileNav } from '@/components/layout/MobileNav'

function useStorefrontHeaderHeight() {
  useEffect(() => {
    const header = document.getElementById('storefront-header')
    if (!header) return

    const sync = () => {
      document.documentElement.style.setProperty(
        '--storefront-header-height',
        `${header.offsetHeight}px`
      )
    }

    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(header)
    window.addEventListener('resize', sync)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [])
}

export function StorefrontLayout() {
  useStorefrontHeaderHeight()

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip pb-16 md:pb-0">
      <TopBar />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
    </div>
  )
}
