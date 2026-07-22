import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-2xl bg-ivory-3', className)}
      {...props}
    />
  )
}

export { Skeleton }
