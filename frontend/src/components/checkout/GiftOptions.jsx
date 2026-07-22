import { useTranslation } from 'react-i18next'
import { Gift } from 'lucide-react'

export function GiftOptions({ isGift, giftNote, onIsGiftChange, onGiftNoteChange }) {
  const { t } = useTranslation('checkout')

  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={isGift}
          onChange={(e) => onIsGiftChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--navy)]"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold text-navy">
            <Gift className="h-4 w-4 shrink-0 text-gold" />
            {t('giftOrder')}
          </span>
          <span className="mt-0.5 block text-xs text-muted">{t('giftOrderDesc')}</span>
        </span>
      </label>
      {isGift && (
        <div className="mt-3 border-t border-line pt-3">
          <label htmlFor="gift-note" className="mb-1.5 block text-xs font-semibold text-navy">
            {t('giftNote')}
          </label>
          <textarea
            id="gift-note"
            value={giftNote}
            onChange={(e) => onGiftNoteChange(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={t('giftNotePlaceholder')}
            className="w-full resize-y rounded-lg border border-line bg-ivory px-3 py-2 text-sm"
          />
          <p className="mt-1 text-right text-[11px] text-muted">
            {t('giftNoteCounter', { length: giftNote.length })}
          </p>
        </div>
      )}
    </div>
  )
}
