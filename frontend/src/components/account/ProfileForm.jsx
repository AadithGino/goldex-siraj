import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { updateCustomerProfile } from '@/lib/commerceApi'

export function ProfileForm() {
  const { t } = useTranslation(['account', 'common', 'errors'])
  const { customer } = useCustomerAuth()
  const queryClient = useQueryClient()
  const [fullName, setFullName] = useState(customer?.full_name || '')
  const [email, setEmail] = useState(customer?.email || '')

  useEffect(() => {
    setFullName(customer?.full_name || '')
    setEmail(customer?.email || '')
  }, [customer?.full_name, customer?.email])

  const mutation = useMutation({
    mutationFn: async () => {
      return updateCustomerProfile({ fullName, email })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-profile'] })
      toast.success(t('common:profileUpdated'))
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate(undefined, {
      onError: (err) => toast.error(err.message || t('errors:account.updateProfileFailed')),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-navy">{t('account:phone')}</label>
        <Input value={customer?.phone || ''} disabled />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-navy">{t('account:fullName')}</label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-navy">{t('account:emailOptional')}</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('account:emailPlaceholder')}
        />
      </div>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? t('common:saving') : t('common:saveProfile')}
      </Button>
    </form>
  )
}
