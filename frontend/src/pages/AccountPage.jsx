import { Link } from 'react-router-dom'
import { LogOut, MapPin, Package, PiggyBank, User, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { RequireCustomer } from '@/components/auth/RequireCustomer'
import { ProfileForm } from '@/components/account/ProfileForm'
import { AddressList } from '@/components/account/AddressList'
import { WalletHistory } from '@/components/account/WalletHistory'
import { SchemeAccountTab } from '@/components/scheme/SchemeAccountTab'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { useStoreSettings } from '@/hooks/useStoreSettings'
import { useWalletBalance, useWalletTransactions } from '@/hooks/useWallet'
import { formatAED } from '@/lib/pricing'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function AccountPageContent() {
  const { t } = useTranslation(['account', 'common', 'errors'])
  const { customer, signOut } = useCustomerAuth()
  const { data: settings } = useStoreSettings()
  const { data: walletBalance = 0 } = useWalletBalance()
  const { data: walletTxs, isLoading: walletLoading } = useWalletTransactions()
  const schemeEnabled = settings?.scheme_enabled

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success(t('common:signedOut'))
    } catch (err) {
      toast.error(err.message || t('errors:account.signOutFailed'))
    }
  }

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('common:accountLabel')}</p>
          <h1 className="font-display text-[clamp(28px,3.3vw,46px)] text-navy">
            {t('common:hello', {
              name: customer?.full_name ? `, ${customer.full_name.split(' ')[0]}` : '',
            })}
          </h1>
          <p className="mt-1 text-sm text-muted">{customer?.phone || 'No phone'}</p>
        </div>
        <Button variant="outline" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          {t('account:signOut')}
        </Button>
      </div>

      <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-line bg-ivory-3 p-4 sm:p-5">
        <span className="flex items-center gap-2 text-sm text-navy">
          <Wallet className="h-5 w-5 text-gold" />
          {t('account:walletBalance')}
        </span>
        <strong className="font-display text-xl text-navy">{formatAED(walletBalance)}</strong>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/orders">
            <Package className="h-4 w-4" />
            {t('account:myOrders')}
          </Link>
        </Button>
        {schemeEnabled && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/scheme/track">
              <PiggyBank className="h-4 w-4" />
              {t('account:goldScheme')}
            </Link>
          </Button>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link to="/wishlist">{t('account:wishlist')}</Link>
        </Button>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-6 w-full justify-start overflow-x-auto">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            {t('account:tab.profile')}
          </TabsTrigger>
          <TabsTrigger value="addresses" className="gap-2">
            <MapPin className="h-4 w-4" />
            {t('account:tab.addresses')}
          </TabsTrigger>
          <TabsTrigger value="wallet" className="gap-2">
            <Wallet className="h-4 w-4" />
            {t('account:tab.wallet')}
          </TabsTrigger>
          {schemeEnabled && (
            <TabsTrigger value="scheme" className="gap-2">
              <PiggyBank className="h-4 w-4" />
              {t('account:tab.scheme')}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <div className="max-w-lg rounded-[28px] border border-gold/20 bg-ivory-2 p-4 sm:p-6">
            <h2 className="font-display text-lg text-navy">{t('account:profileDetails')}</h2>
            <div className="mt-4">
              <ProfileForm />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="addresses">
          <div className="max-w-2xl">
            <h2 className="mb-4 font-display text-lg text-navy">{t('account:savedAddresses')}</h2>
            <AddressList />
          </div>
        </TabsContent>

        <TabsContent value="wallet">
          <div className="max-w-2xl">
            <h2 className="mb-1 font-display text-lg text-navy">{t('account:walletTitle')}</h2>
            <p className="mb-5 text-sm text-muted">{t('account:walletDesc')}</p>
            <WalletHistory
              transactions={walletTxs}
              isLoading={walletLoading}
              balance={walletBalance}
            />
          </div>
        </TabsContent>

        {schemeEnabled && (
          <TabsContent value="scheme">
            <SchemeAccountTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

export function AccountPage() {
  return (
    <RequireCustomer>
      <AccountPageContent />
    </RequireCustomer>
  )
}
