import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

/**
 * Styled select with label — matches Goldex form inputs (rounded pill trigger).
 */
export function LabeledSelect({
  label,
  hint,
  value,
  onValueChange,
  options = [],
  placeholder = 'Select…',
  disabled = false,
  className,
  triggerClassName,
}) {
  const stringValue = value == null || value === '' ? undefined : String(value)

  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label className="block text-sm font-medium text-navy">{label}</label>
      ) : null}
      <Select
        value={stringValue}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger className={cn('h-12 rounded-2xl', triggerClassName)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <p className="text-xs leading-relaxed text-muted">{hint}</p> : null}
    </div>
  )
}
