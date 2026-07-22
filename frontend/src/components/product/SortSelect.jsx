import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getSortOptions } from '@/lib/i18nLabels'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Right-aligned "Sort By" used in listing headers (reference layout). */
export function SortSelect({ value, onChange }) {
  const { t } = useTranslation(['product', 'common'])
  const sortOptions = useMemo(() => getSortOptions(t), [t])

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-muted sm:inline">{t('product:sortBy')}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-40">
          <SelectValue placeholder={t('product:sortPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
