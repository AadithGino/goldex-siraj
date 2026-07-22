import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function LanguageSwitcher({ className, compact = false }) {
  const { i18n } = useTranslation()
  const current = i18n.language?.startsWith('ar') ? 'ar' : 'en'

  const setLang = (lng) => {
    if (lng !== current) i18n.changeLanguage(lng)
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center rounded-full border border-gold/30 bg-ivory-2 p-0.5 font-semibold',
        compact ? 'text-[10px]' : 'text-xs',
        className
      )}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLang('en')}
        className={cn(
          'rounded-full transition-colors',
          compact ? 'px-1.5 py-0.5 sm:px-2 sm:py-1' : 'px-2.5 py-1',
          current === 'en' ? 'bg-navy text-ivory' : 'text-navy hover:text-gold'
        )}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang('ar')}
        className={cn(
          'rounded-full transition-colors',
          compact ? 'px-1.5 py-0.5 sm:px-2 sm:py-1' : 'px-2.5 py-1',
          current === 'ar' ? 'bg-navy text-ivory' : 'text-navy hover:text-gold'
        )}
      >
        ع
      </button>
    </div>
  )
}
