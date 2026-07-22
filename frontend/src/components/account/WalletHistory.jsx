import { format } from 'date-fns'
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAED } from '@/lib/pricing'
import { cn } from '@/lib/utils'

function getTypeMeta(t) {
  return {
    scheme_payout: {
      label: t('account:walletTx.schemePayout'),
      description: t('account:walletTx.schemePayoutDesc'),
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      icon: ArrowDownLeft,
    },
    purchase: {
      label: t('account:walletTx.purchase'),
      description: t('account:walletTx.purchaseDesc'),
      color: 'text-[#b3261e]',
      bg: 'bg-red-50',
      icon: ArrowUpRight,
    },
    refund: {
      label: t('account:walletTx.refund'),
      description: t('account:walletTx.refundDesc'),
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      icon: ArrowDownLeft,
    },
    adjustment: {
      label: t('account:walletTx.adjustment'),
      description: t('account:walletTx.adjustmentDesc'),
      color: 'text-navy',
      bg: 'bg-ivory-3',
      icon: Wallet,
    },
  }
}

function TxRow({ tx, typeMeta }) {
  const meta = typeMeta[tx.type] || typeMeta.adjustment
  const Icon = meta.icon
  const isCredit = tx.amount > 0

  return (
    <div className="flex items-center gap-3 border-b border-gold/10 py-3 last:border-0">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', meta.bg)}>
        <Icon className={cn('h-4 w-4', meta.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-navy">{tx.note || meta.label}</p>
        <p className="text-xs text-muted">
          {meta.label} · {format(new Date(tx.created_at), 'dd MMM yyyy · h:mm a')}
        </p>
      </div>
      <span className={cn('font-display text-base font-semibold tabular-nums', isCredit ? 'text-emerald-600' : 'text-[#b3261e]')}>
        {isCredit ? '+' : ''}{formatAED(tx.amount)}
      </span>
    </div>
  )
}

export function WalletHistory({ transactions, isLoading, balance }) {
  const { t } = useTranslation('account')
  const typeMeta = getTypeMeta(t)

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {balance != null && (
        <div className="flex items-center justify-between rounded-2xl border border-gold/20 bg-ivory-3 px-5 py-4">
          <span className="flex items-center gap-2 text-sm font-medium text-navy">
            <Wallet className="h-5 w-5 text-gold" />
            {t('availableBalance')}
          </span>
          <span className="font-display text-2xl text-navy">{formatAED(balance)}</span>
        </div>
      )}

      {!transactions?.length ? (
        <div className="rounded-[28px] border border-gold/20 bg-ivory-2 p-8 text-center">
          <Wallet className="mx-auto mb-3 h-8 w-8 text-gold/40" />
          <p className="text-sm font-medium text-navy">{t('noTransactions')}</p>
          <p className="mt-1 text-xs text-muted">{t('noTransactionsDesc')}</p>
        </div>
      ) : (
        <div className="rounded-[28px] border border-gold/20 bg-ivory-2 px-5">
          {transactions.map((tx) => (
            <TxRow key={tx.id} tx={tx} typeMeta={typeMeta} />
          ))}
        </div>
      )}
    </div>
  )
}
