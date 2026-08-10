import { useEffect, useId, useRef, useState } from 'react'
import { Search, User, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAdminCustomers } from '@/hooks/useAdminCustomers'

const MIN_QUERY = 2
const DEBOUNCE_MS = 300

export function CustomerSearchField({
  value,
  onChange,
  disabled = false,
  className,
}) {
  const listId = useId()
  const containerRef = useRef(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!value) {
      setQuery('')
      setDebouncedQuery('')
    }
  }, [value])

  useEffect(() => {
    const handleClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const { data, isFetching } = useAdminCustomers({
    search: debouncedQuery,
    status: 'active',
    page: 1,
  })
  const customers = debouncedQuery.length >= MIN_QUERY ? (data?.customers || []) : []

  const selectCustomer = (customer) => {
    onChange(customer)
    setQuery('')
    setDebouncedQuery('')
    setOpen(false)
  }

  const clearSelection = () => {
    onChange(null)
    setQuery('')
    setDebouncedQuery('')
    setOpen(true)
  }

  if (value) {
    return (
      <div className={cn('rounded-2xl border border-gold/25 bg-ivory px-4 py-3', className)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-navy">{value.full_name || 'Customer'}</p>
              <p className="truncate text-sm text-muted">{value.phone || '—'}</p>
              {value.email ? (
                <p className="truncate text-xs text-muted">{value.email}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={clearSelection}
            disabled={disabled}
            className="rounded-full p-1 text-muted transition-colors hover:bg-line/60 hover:text-navy disabled:opacity-50"
            aria-label="Clear customer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <label htmlFor={`${listId}-input`} className="mb-1.5 block text-sm font-medium text-navy">
        Customer
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          id={`${listId}-input`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search by name or phone number…"
          disabled={disabled}
          className="rounded-2xl pl-9"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          autoComplete="off"
        />
      </div>
      <p className="mt-1 text-xs text-muted">Type at least 2 characters — matches name, email, or phone digits.</p>

      {open && debouncedQuery.length >= MIN_QUERY && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-2xl border border-gold/20 bg-ivory py-1 shadow-lg"
        >
          {isFetching && customers.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">Searching…</li>
          ) : null}
          {!isFetching && customers.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No customers found</li>
          ) : null}
          {customers.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                role="option"
                className="flex w-full flex-col px-4 py-2.5 text-left transition-colors hover:bg-gold/10"
                onClick={() => selectCustomer(customer)}
              >
                <span className="font-medium text-navy">{customer.full_name || 'Customer'}</span>
                <span className="text-sm text-muted">{customer.phone || '—'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
