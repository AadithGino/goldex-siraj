import { useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useStoreSettings } from '@/hooks/useStoreSettings'
import { getContentLang } from '@/lib/contentLocale'
import { cn } from '@/lib/utils'

const SCRIPTS = {
  promo: { src: 'https://checkout.tabby.ai/tabby-promo.js', global: 'TabbyPromo' },
  card: { src: 'https://checkout.tabby.ai/tabby-card.js', global: 'TabbyCard' },
}

const loaders = {}

function loadScript(src) {
  if (!loaders[src]) {
    loaders[src] = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.async = true
      script.onload = resolve
      script.onerror = () => {
        delete loaders[src]
        reject(new Error(`Failed to load ${src}`))
      }
      document.head.appendChild(script)
    })
  }
  return loaders[src]
}

export function useTabbySnippetConfig() {
  const { data: settings } = useStoreSettings()
  const publicKey = settings?.tabby_public_key || null
  const merchantCode = settings?.tabby_merchant_code || null
  return {
    enabled: Boolean(settings?.online_checkout_enabled && settings?.tabby_configured && publicKey && merchantCode),
    publicKey,
    merchantCode,
  }
}

function TabbyWidget({ kind, price, source, className }) {
  const { i18n } = useTranslation()
  const lang = getContentLang(i18n.language)
  const { enabled, publicKey, merchantCode } = useTabbySnippetConfig()
  // Must not equal "TabbyPromo"/"TabbyCard": element ids on window shadow the Tabby constructors.
  const containerId = `goldex-tabby-${kind}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const amount = Number(price)
  const hasAmount = Number.isFinite(amount) && amount > 0

  useEffect(() => {
    if (!enabled || !hasAmount) return undefined
    let cancelled = false
    const { src, global } = SCRIPTS[kind]
    loadScript(src)
      .then(() => {
        if (cancelled) return
        const container = document.getElementById(containerId)
        const Widget = window[global]
        if (!container || typeof Widget !== 'function') return
        container.innerHTML = ''
        new Widget({
          selector: `#${containerId}`,
          currency: 'AED',
          price: amount.toFixed(2),
          lang,
          ...(kind === 'promo' ? { source } : {}),
          shouldInheritBg: false,
          publicKey,
          merchantCode,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [enabled, hasAmount, amount, lang, source, kind, containerId, publicKey, merchantCode])

  if (!enabled || !hasAmount) return null
  return <div id={containerId} className={cn('w-full min-w-0 max-w-full overflow-hidden', className)} />
}

/** Product / cart split-price messaging (`TabbyPromo`). */
export function TabbyPromoSnippet({ price, source = 'product', className }) {
  return <TabbyWidget kind="promo" price={price} source={source} className={className} />
}

/** Checkout snippet shown under the selected Tabby payment method (`TabbyCard`). */
export function TabbyCardSnippet({ price, className }) {
  return <TabbyWidget kind="card" price={price} className={className} />
}
