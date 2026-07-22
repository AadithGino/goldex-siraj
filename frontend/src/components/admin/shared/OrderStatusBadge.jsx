import { Badge } from '@/components/ui/badge'
import { ORDER_STATUS_LABELS, ORDER_STATUS_VARIANT } from '@/lib/constants'

export function OrderStatusBadge({ status }) {
  return (
    <Badge variant={ORDER_STATUS_VARIANT[status] || 'muted'}>
      {ORDER_STATUS_LABELS[status] || status}
    </Badge>
  )
}
