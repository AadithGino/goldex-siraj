import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-gold/30 bg-ivory-3 text-navy',
        navy: 'border-navy bg-navy text-gold-3',
        gold: 'border-gold bg-gold/10 text-gold',
        outline: 'border-navy/30 text-navy',
        success: 'border-[#2f7d4f]/30 bg-[#2f7d4f]/10 text-[#2f7d4f]',
        destructive: 'border-[#b3261e]/30 bg-[#b3261e]/10 text-[#b3261e]',
        muted: 'border-muted/30 bg-ivory-3 text-muted',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
