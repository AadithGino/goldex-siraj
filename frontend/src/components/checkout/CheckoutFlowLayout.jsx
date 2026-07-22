import { cn } from '@/lib/utils'

export function CheckoutFlowLayout({ main, sidebar, className }) {
  return (
    <div
      className={cn(
        'grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-10 xl:gap-12',
        className
      )}
    >
      <div className="order-2 min-w-0 lg:order-1">{main}</div>
      <aside className="order-1 lg:sticky lg:top-24 lg:order-2 lg:self-start">{sidebar}</aside>
    </div>
  )
}
