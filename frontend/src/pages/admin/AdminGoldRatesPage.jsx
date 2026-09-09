import { useState } from 'react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { GoldRateHistoryTable } from '@/components/admin/shared/RateHistoryTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatINR } from '@/lib/pricing'
import {
  useAdminGoldBuybackRates,
  useAdminGoldRates,
  useSetGoldBuybackRate,
  useSetGoldRate,
} from '@/hooks/useAdminGoldRates'
import { PURITIES } from '@/lib/constants'
import { formatDateSafe, parseDateSafe } from '@/lib/date'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function RateBoard({
  description,
  rates,
  isLoading,
  mutation,
  successLabel,
}) {
  const [purity, setPurity] = useState('22k')
  const [rate, setRateValue] = useState('')

  const currentRates = PURITIES.map((p) => ({
    purity: p,
    current: rates?.find((r) => r.purity === p && r.is_current),
  }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!rate) return
    try {
      await mutation.mutateAsync({ purity, rate: Number(rate) })
      toast.success(`${purity.toUpperCase()} ${successLabel}`)
      setRateValue('')
    } catch (err) {
      toast.error(err.message || 'Failed to set rate')
    }
  }

  return (
    <section>
      <p className="mb-5 max-w-2xl text-sm text-muted">{description}</p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {currentRates.map(({ purity: p, current }) => (
          <div
            key={p}
            className="rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-6"
          >
            <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{p}</p>
            {isLoading ? (
              <Skeleton className="mt-2 h-8 w-24" />
            ) : current ? (
              <>
                <p className="mt-2 font-display text-2xl text-navy">
                  {formatINR(current.rate_per_gram)}/g
                </p>
                {parseDateSafe(current.effective_at) ? (
                  <p className="mt-1 text-xs text-muted">
                    Since {formatDateSafe(current.effective_at, 'dd MMM yyyy')}
                  </p>
                ) : null}
                {current.changed_by_name && (
                  <p className="mt-1 text-xs text-muted">Set by {current.changed_by_name}</p>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">No current rate</p>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="max-w-md space-y-4 rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-6"
      >
        <h3 className="font-display text-lg text-navy">Set new rate</h3>
        <div>
          <label className="mb-2 block text-sm font-medium text-navy">Purity</label>
          <Select value={purity} onValueChange={setPurity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PURITIES.map((p) => (
                <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-navy">Rate per gram (AED)</label>
          <Input
            type="number"
            value={rate}
            onChange={(e) => setRateValue(e.target.value)}
            placeholder="7150"
            required
          />
        </div>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Update rate'}
        </Button>
      </form>

      {rates?.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-4 font-display text-lg text-navy">Rate history</h3>
          <GoldRateHistoryTable rows={rates.slice(0, 20)} />
        </div>
      )}
    </section>
  )
}

export function AdminGoldRatesPage() {
  const [mode, setMode] = useState('buy')
  const { data: rates, isLoading } = useAdminGoldRates()
  const setRate = useSetGoldRate()
  const { data: buybackRates, isLoading: buybackLoading } = useAdminGoldBuybackRates()
  const setBuyback = useSetGoldBuybackRate()

  return (
    <div>
      <AdminPageHeader
        title="Gold rates"
        description="Switch between storefront buy rates and customer sell-in rates. Each purity keeps its own history."
      />

      <Tabs value={mode} onValueChange={setMode} className="max-w-4xl">
        <TabsList className="mb-6 grid h-auto w-full grid-cols-2 sm:w-[420px]">
          <TabsTrigger value="buy" className="px-3">Buy · storefront</TabsTrigger>
          <TabsTrigger value="sell" className="px-3">Sell · customer buyback</TabsTrigger>
        </TabsList>

        <TabsContent value="buy">
          <RateBoard
            description="Used for product pricing and custom jewellery quotes. Storefront prices update automatically."
            rates={rates}
            isLoading={isLoading}
            mutation={setRate}
            successLabel="retail rate updated — previous rate saved in history"
          />
        </TabsContent>

        <TabsContent value="sell">
          <RateBoard
            description="Shown on the sell jewellery form as the indicative payout. Admin can still adjust the final offer after inspection."
            rates={buybackRates}
            isLoading={buybackLoading}
            mutation={setBuyback}
            successLabel="sell-in rate updated — previous rate saved in history"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
