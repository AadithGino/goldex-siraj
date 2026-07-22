import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:pointer-events-none disabled:opacity-50 min-h-[48px] px-6',
  {
    variants: {
      variant: {
        // Primary = solid deep navy (Bluestone style)
        default:
          'bg-navy !text-white shadow-[0_8px_20px_rgba(20,33,61,.20)] hover:bg-navy-2 hover:!text-white',
        // Gold accent CTA — use sparingly for premium highlights
        gold:
          'bg-[linear-gradient(135deg,var(--gold),var(--gold-2))] text-navy shadow-[0_8px_20px_rgba(184,144,47,.28)] hover:brightness-105',
        outline:
          'border border-line-strong bg-white text-navy hover:border-navy hover:bg-ivory-3',
        navy: 'bg-navy !text-white hover:bg-navy-2 hover:!text-white',
        ghost: 'text-navy hover:bg-ivory-3',
        link: 'text-navy underline-offset-4 hover:underline min-h-0 px-0',
      },
      size: {
        default: 'min-h-[48px] px-6',
        sm: 'min-h-[40px] px-4 text-xs',
        lg: 'min-h-[52px] px-8 text-base',
        icon: 'h-11 w-11 min-h-0 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
