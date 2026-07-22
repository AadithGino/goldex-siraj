import * as React from 'react'
import { cn } from '@/lib/utils'

function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-[28px] border border-gold/20 bg-ivory-2 text-ink shadow-[0_14px_34px_rgba(7,21,37,.09)] transition-all',
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }) {
  return (
    <div className={cn('flex flex-col gap-1.5 p-4 sm:p-6', className)} {...props} />
  )
}

function CardTitle({ className, ...props }) {
  return (
    <h3
      className={cn('font-display text-xl leading-none tracking-wide text-navy', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }) {
  return <p className={cn('text-sm text-muted', className)} {...props} />
}

function CardContent({ className, ...props }) {
  return <div className={cn('p-4 pt-0 sm:p-6 sm:pt-0', className)} {...props} />
}

function CardFooter({ className, ...props }) {
  return (
    <div className={cn('flex items-center p-4 pt-0 sm:p-6 sm:pt-0', className)} {...props} />
  )
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
