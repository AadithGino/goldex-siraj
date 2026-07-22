import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * EN | ع tabs for bilingual admin content fields.
 * English is required; Arabic is optional (falls back to English on storefront).
 */
export function LocaleFieldTabs({ children, className }) {
  const [tab, setTab] = useState('en')

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <div
          className="flex items-center rounded-full border border-gold/30 bg-ivory-3 p-0.5 text-xs font-semibold"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'en'}
            onClick={() => setTab('en')}
            className={cn(
              'rounded-full px-3 py-1 transition-colors',
              tab === 'en' ? 'bg-navy text-ivory' : 'text-navy hover:text-gold'
            )}
          >
            English
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'ar'}
            onClick={() => setTab('ar')}
            className={cn(
              'rounded-full px-3 py-1 transition-colors',
              tab === 'ar' ? 'bg-navy text-ivory' : 'text-navy hover:text-gold'
            )}
          >
            عربي
          </button>
        </div>
        {tab === 'ar' && (
          <p className="text-xs text-muted">Optional — falls back to English if empty</p>
        )}
      </div>
      {typeof children === 'function' ? children(tab) : children}
    </div>
  )
}

export function LocaleSection({ title, children, className }) {
  return (
    <div className={cn('space-y-3 rounded-2xl border border-gold/20 bg-ivory p-4', className)}>
      <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{title}</p>
      {children}
    </div>
  )
}

/** Badge for admin lists when Arabic content exists */
export function ArabicContentBadge({ show, className }) {
  if (!show) return null
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold',
        className
      )}
    >
      AR
    </span>
  )
}
