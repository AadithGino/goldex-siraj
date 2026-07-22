import { createContext, useContext, useMemo } from 'react'
import { useCart } from '@/hooks/useCart'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { isAuthenticated } = useCustomerAuth()
  const { itemCount } = useCart()

  const value = useMemo(
    () => ({
      count: isAuthenticated ? itemCount : 0,
    }),
    [isAuthenticated, itemCount]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCartBadge() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCartBadge must be used within CartProvider')
  }
  return context
}
