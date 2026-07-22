import { Link } from 'react-router-dom'
import { Instagram, Facebook, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStoreSettings } from '@/hooks/useStoreSettings'
import { BrandWordmark } from '@/components/ui/BrandLogo'
import { useContentLang } from '@/hooks/useContentLang'
import {
  STORE_EMAIL,
  STORE_COMPLIANCE_EMAIL,
  getStoreLegalName,
} from '@/lib/storeIdentity'
import { POLICY_PAGES, getPolicyLabel } from '@/lib/policyPages'

export function Footer() {
  const { t } = useTranslation(['nav', 'common'])
  const lang = useContentLang()
  const { data: settings } = useStoreSettings()

  const legalName = getStoreLegalName(lang)
  const supportEmail = settings?.support_email || STORE_EMAIL

  return (
    <footer className="mt-auto bg-navy text-gold-3">
      <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center">
              <BrandWordmark className="h-9" />
            </div>
            <p className="mt-2 text-sm font-medium text-gold-3/90">{legalName}</p>
            <p className="mt-2 text-sm text-gold-3/80">{t('common:footerTagline')}</p>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('nav:footer.shopHeading')}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/search" className="hover:text-gold">{t('nav:footer.allJewellery')}</Link>
              </li>
              {settings?.scheme_enabled && (
                <li>
                  <Link to="/scheme" className="hover:text-gold">{t('nav:footer.goldScheme')}</Link>
                </li>
              )}
            </ul>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('nav:footer.policiesHeading')}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {POLICY_PAGES.map((policy) => (
                <li key={policy.slug}>
                  <Link to={`/page/${policy.slug}`} className="hover:text-gold">
                    {getPolicyLabel(policy, lang)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('nav:footer.contactHeading')}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {settings?.support_phone && <li>{settings.support_phone}</li>}
              <li>
                <a href={`mailto:${supportEmail}`} className="hover:text-gold">
                  {supportEmail}
                </a>
              </li>
              <li>
                <span className="text-gold-3/60">{t('common:footerComplianceEmail')}: </span>
                <a href={`mailto:${STORE_COMPLIANCE_EMAIL}`} className="hover:text-gold">
                  {STORE_COMPLIANCE_EMAIL}
                </a>
              </li>
            </ul>
            <div className="mt-3 flex gap-3">
              <a href="#" className="rounded-full border border-gold/30 p-2 hover:bg-navy-2">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="#" className="rounded-full border border-gold/30 p-2 hover:bg-navy-2">
                <Facebook className="h-4 w-4" />
              </a>
              <a href={`mailto:${supportEmail}`} className="rounded-full border border-gold/30 p-2 hover:bg-navy-2">
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-gold/20 pt-6 text-center text-xs text-gold-3/70">
          {t('common:copyright', { year: new Date().getFullYear(), storeName: legalName })}
        </div>
      </div>
    </footer>
  )
}
