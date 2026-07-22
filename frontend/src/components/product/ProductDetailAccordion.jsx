import { cn } from '@/lib/utils'

export function ProductDetailAccordion({ title, children, defaultOpen = false, className }) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        'group rounded-2xl border border-gold/20 bg-ivory-2',
        className
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5 text-sm font-semibold text-navy sm:px-5 [&::-webkit-details-marker]:hidden">
        {title}
        <span className="text-gold transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="border-t border-gold/10 px-4 pb-4 pt-3 sm:px-5">{children}</div>
    </details>
  )
}
