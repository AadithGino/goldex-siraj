import { useMutation } from '@tanstack/react-query'
import { validateCoupon } from '@/lib/commerceApi'

export function useValidateCoupon() {
  return useMutation({
    mutationFn: async ({ code, orderTotal }) => {
      return validateCoupon(code, orderTotal)
    },
  })
}
