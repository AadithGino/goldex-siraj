import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { CustomerAuthProvider } from '@/contexts/CustomerAuthContext'
import { StaffAuthProvider } from '@/contexts/StaffAuthContext'
import { CartProvider } from '@/contexts/CartContext'
import App from '@/App'
import '@/i18n'
import '@/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <CustomerAuthProvider>
        <CartProvider>
          <StaffAuthProvider>
            <App />
            <Toaster position="top-center" richColors closeButton />
          </StaffAuthProvider>
        </CartProvider>
      </CustomerAuthProvider>
    </QueryClientProvider>
  </StrictMode>
)
