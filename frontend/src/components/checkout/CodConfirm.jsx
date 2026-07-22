import { Banknote } from 'lucide-react'
import { formatINR } from '@/lib/pricing'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function CodConfirm({ total, onConfirm, isPlacing }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Banknote className="h-5 w-5 text-gold" />
          Cash on Delivery
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted">
          Pay {formatINR(total)} in cash when your order is delivered. Our team will verify your
          identity at the door.
        </p>
        <ul className="space-y-2 text-sm text-muted">
          <li>• Order confirmed after placement</li>
          <li>• Insured shipping with tamper-proof packaging</li>
          <li>• Final amount based on live gold rates at checkout</li>
        </ul>
        <Button className="w-full" onClick={onConfirm} disabled={isPlacing}>
          {isPlacing ? 'Placing order…' : `Place COD Order — ${formatINR(total)}`}
        </Button>
      </CardContent>
    </Card>
  )
}
