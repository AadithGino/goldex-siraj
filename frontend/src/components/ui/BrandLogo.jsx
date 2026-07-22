import { cn } from '@/lib/utils'

export function BrandMark({ className = '', alt = 'Goldex mark' }) {
  return (
    <img
      src="/GOLDEX2.png"
      alt={alt}
      className={cn('h-8 w-8 shrink-0 object-contain', className)}
      loading="eager"
      decoding="async"
    />
  )
}

export function BrandWordmark({ className = '', alt = 'Goldex Jewellery' }) {
  return (
    <img
      src="/GOLDEX2wordmark.png"
      alt={alt}
      className={cn('h-8 w-auto shrink-0 object-contain', className)}
      loading="eager"
      decoding="async"
    />
  )
}
